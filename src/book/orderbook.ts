/**
 * Copyright (C) 2021-2022 diva.exchange
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Author/Maintainer: Konrad Bächler <konrad@diva.exchange>
 */

import { Big } from 'big.js';
import { Config } from '../config/config';
import get from 'simple-get';
import { Logger } from '../util/logger';
import crypto from 'crypto';

export type Book = {
  buy: Array<BookEntry>;
  sell: Array<BookEntry>;
};

type BookEntry = {
  id: number;
  p: string;
  a: string;
};

type KeyValue = {
  key: string;
  value: string;
};

export class Orderbook {
  private readonly BUY = 'buy';

  private static instance: Orderbook;
  private readonly config: Config;
  private mapHash: Map<string, string>;
  private mapBook: Map<string, Map<string, Book>>;
  private mapMarket: Map<string, Book>;

  static async make(config: Config): Promise<Orderbook> {
    // Singleton
    if (!this.instance) {
      this.instance = new Orderbook(config);
      for (const contract of config.contracts_array) {
        await this.instance.fetchOrderBook(contract);
      }
    }
    return this.instance;
  }

  private constructor(config: Config) {
    this.config = config;
    this.mapHash = new Map();
    this.mapBook = new Map();
    this.mapMarket = new Map();
  }

  public getNostro(contract: string): Book {
    const mapBook = this.mapBook.get(contract);
    if (!mapBook) {
      return { buy: [], sell: [] };
    }
    return mapBook.get(this.config.my_public_key) || { buy: [], sell: [] };
  }

  public getMarket(contract: string): Book {
    return this.mapMarket.get(contract) || { buy: [], sell: [] };
  }

  public add(id: number, contract: string, type: string, price: number, amount: number) {
    const b = this.mapBook.get(contract);
    if (!b) {
      throw new Error('Orderbook.add(): invalid contract');
    }
    const book = b.get(this.config.my_public_key) || { buy: [], sell: [] };
    if (type === this.BUY) {
      book.buy.push({
        id: id,
        p: Big(price).toFixed(this.config.decimalPrecision),
        a: Big(amount).toFixed(this.config.decimalPrecision),
      });
      book.buy.sort((a: BookEntry, b: BookEntry) => (Big(a.p).lt(b.p) ? 1 : Big(a.p).eq(b.p) && a.id > b.id ? 1 : -1));
    } else {
      book.sell.push({
        id: id,
        p: Big(price).toFixed(this.config.decimalPrecision),
        a: Big(amount).toFixed(this.config.decimalPrecision),
      });
      book.sell.sort((a: BookEntry, b: BookEntry) => (Big(a.p).gt(b.p) ? 1 : Big(a.p).eq(b.p) && a.id > b.id ? 1 : -1));
    }

    b.set(this.config.my_public_key, book);
    this.mapBook.set(contract, b);
  }

  public delete(id: number, contract: string, type: string) {
    const b = this.mapBook.get(contract);
    if (!b) {
      throw new Error('Orderbook.delete(): invalid contract');
    }
    const book = b.get(this.config.my_public_key);
    if (!book) {
      return;
    }

    if (type === this.BUY) {
      book.buy = book.buy.filter((r: BookEntry) => r.id !== id);
    } else {
      book.sell = book.sell.filter((r: BookEntry) => r.id !== id);
    }
    b.set(this.config.my_public_key, book);
    this.mapBook.set(contract, b);
  }

  /**
   * Reads Order Book from Chain and updates the in-memory caches
   *
   * @param contract
   */
  public fetchOrderBook(contract: string): Promise<Boolean> {
    const url: string = this.config.url_api_chain + '/state/search/DivaExchange:OrderBook:' + contract;
    return new Promise((resolve) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        try {
          const hash = this.mapHash.get(contract) || '';
          const md5 = crypto.createHash('md5').update(data).digest('hex');
          if (hash !== md5) {
            const o: Array<KeyValue> = JSON.parse(data);
            this.mapHash.set(contract, md5);
            const mapBook = new Map();
            o.forEach((v) => {
              const b = JSON.parse(v.value);
              const pk = v.key.split(':')[3];
              if (pk.length && (b.buy.length || b.sell.length)) {
                b.buy.sort((a: BookEntry, b: BookEntry) =>
                  Big(a.p).lt(b.p) ? 1 : Big(a.p).eq(b.p) && a.id > b.id ? 1 : -1
                );
                b.sell.sort((a: BookEntry, b: BookEntry) =>
                  Big(a.p).gt(b.p) ? 1 : Big(a.p).eq(b.p) && a.id > b.id ? 1 : -1
                );
                mapBook.set(pk, { buy: b.buy, sell: b.sell });
              }
            });
            this.mapBook.set(contract, mapBook);

            // update market
            const buy: { [price: string]: BookEntry } = {};
            const sell: { [price: string]: BookEntry } = {};
            mapBook.forEach((v: Book) => {
              v.buy.forEach((_b) => {
                buy[_b.p] = buy[_b.p] || { id: 0, p: _b.p, a: '0' };
                buy[_b.p].a = Big(buy[_b.p].a).plus(_b.a).toFixed(this.config.decimalPrecision);
                buy[_b.p].id = buy[_b.p].id > _b.id ? buy[_b.p].id : _b.id;
              });

              v.sell.forEach((_b) => {
                sell[_b.p] = sell[_b.p] || { id: 0, p: _b.p, a: '0' };
                sell[_b.p].a = Big(sell[_b.p].a).plus(_b.a).toFixed(this.config.decimalPrecision);
                sell[_b.p].id = sell[_b.p].id > _b.id ? sell[_b.p].id : _b.id;
              });
            });

            this.mapMarket.set(contract, {
              buy: Object.values(buy).sort((a: BookEntry, b: BookEntry) => (Big(a.p).lt(b.p) ? 1 : -1)),
              sell: Object.values(sell).sort((a: BookEntry, b: BookEntry) => (Big(a.p).gt(b.p) ? 1 : -1)),
            });

            resolve(true);
          }
        } catch (error: any) {
          Logger.warn(error);
        }
        resolve(false);
      });
    });
  }
}
