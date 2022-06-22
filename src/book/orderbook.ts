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
import { nanoid } from 'nanoid';

export type Book = {
  buy: Array<BookEntry>;
  sell: Array<BookEntry>;
};

type BookEntry = {
  id: string;
  t: number; // unix time in milliseconds
  p: string;
  a: string;
  h: string;
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
  private mapMatch: Map<string, Book>;

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
    this.mapMatch = new Map();
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

  public hasMatch(contract: string): Boolean {
    return this.mapMatch.has(contract);
  }

  public add(id: string, contract: string, type: string, price: number, amount: number) {
    id = id.trim();
    id = id || nanoid();
    const b = this.mapBook.get(contract);
    if (!id || !b) {
      throw new Error('Orderbook.add(): invalid id or contract');
    }
    const book = b.get(this.config.my_public_key) || { buy: [], sell: [] };
    const p = Big(price).toFixed(this.config.decimalPrecision);
    const a = Big(amount).toFixed(this.config.decimalPrecision);
    const h =
      crypto
        .createHash('md5')
        .update(this.config.my_public_key + a)
        .digest('base64');
    if (type === this.BUY) {
      book.buy.push({ id: id, t: Date.now(), p: p, a: a, h: h });
      book.buy.sort((a: BookEntry, b: BookEntry) => (Big(a.p).lt(b.p) ? 1 : Big(a.p).eq(b.p) && a.t > b.t ? 1 : -1));
    } else {
      book.sell.push({ id: id, t: Date.now(), p: p, a: a, h: h });
      book.sell.sort((a: BookEntry, b: BookEntry) => (Big(a.p).gt(b.p) ? 1 : Big(a.p).eq(b.p) && a.t > b.t ? 1 : -1));
    }

    b.set(this.config.my_public_key, book);
    this.mapBook.set(contract, b);
  }

  public deleteAll(contract: string) {
    const b = this.mapBook.get(contract);
    if (!b) {
      throw new Error('Orderbook.deleteAll(): invalid contract');
    }

    if (b.has(this.config.my_public_key)) {
      b.set(this.config.my_public_key, { buy: [], sell: []});
      this.mapBook.set(contract, b);
    }
  }

  public delete(id: string, contract: string, type: string) {
    id = id.trim();
    const b = this.mapBook.get(contract);
    if (!id || !b) {
      throw new Error('Orderbook.delete(): invalid id or contract');
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
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        const hash = this.mapHash.get(contract) || '';
        const md5 = crypto.createHash('md5').update(data).digest('base64');
        if (hash === md5) {
          resolve(false);
        }
        this.mapHash.set(contract, md5);

        try {
          // upper and lower limits for t
          const tMax = Date.now();
          //@FIXME reasonable? better approaches?
          const tMin = tMax - (365 * 24 * 60 * 60 * 1000); // older than a year

          const o: Array<KeyValue> = JSON.parse(data);
          const mapBook = new Map();
          o.forEach((v) => {
            const bk = JSON.parse(v.value);
            const pk = v.key.split(':')[3];
            if (pk.length && (bk.buy.length || bk.sell.length)) {
              bk.buy = bk.buy.map((v: BookEntry) => {
                const t = Number(v.t) || 0;
                return {
                  id: v.id || '',
                  t: t > tMax ? tMax : t < tMin ? tMin : t,
                  p: Big(v.p || 0).toFixed(this.config.decimalPrecision),
                  a: Big(v.a || 0).toFixed(this.config.decimalPrecision),
                  h: crypto.createHash('md5').update(pk + v.a).digest('base64'),
                }
              });
              // sorting by price, then by md5 hash - this is a protocol decision and not affected by
              // preimage / collision attacks on md5
              bk.buy.sort((a: BookEntry, b: BookEntry) =>
                Big(a.p).lt(b.p) ? 1 : Big(a.p).eq(b.p) && a.h >= b.h ? 1 : -1
              );
              bk.sell = bk.sell.map((v: BookEntry) => {
                const t = Number(v.t) || 0;
                return {
                  id: v.id || '',
                  t: t > tMax ? tMax : t < tMin ? tMin : t,
                  p: Big(v.p || 0).toFixed(this.config.decimalPrecision),
                  a: Big(v.a || 0).toFixed(this.config.decimalPrecision),
                  h: crypto.createHash('md5').update(pk + v.a).digest('base64'),
                }
              });
              bk.sell.sort((a: BookEntry, b: BookEntry) =>
                Big(a.p).gt(b.p) ? 1 : Big(a.p).eq(b.p) && a.h >= b.h ? 1 : -1
              );
              mapBook.set(pk, { buy: bk.buy, sell: bk.sell });
            }
          });

          this.mapBook.set(contract, mapBook);

          const buy: { [price: string]: BookEntry } = {};
          const sell: { [price: string]: BookEntry } = {};

          // update market
          mapBook.forEach((v: Book) => {
            v.buy.forEach((_b) => {
              buy[_b.p] = buy[_b.p] || { id: '', t: 0, p: _b.p, a: '0' };
              buy[_b.p].a = Big(buy[_b.p].a).plus(_b.a).toFixed(this.config.decimalPrecision);
              buy[_b.p].t = buy[_b.p].t > _b.t ? buy[_b.p].t : _b.t;
            });

            v.sell.forEach((_b) => {
              sell[_b.p] = sell[_b.p] || { id: '', t: 0, p: _b.p, a: '0' };
              sell[_b.p].a = Big(sell[_b.p].a).plus(_b.a).toFixed(this.config.decimalPrecision);
              sell[_b.p].t = sell[_b.p].t > _b.t ? sell[_b.p].t : _b.t;
            });
          });

          const m = {
            buy: Object.values(buy).sort((a: BookEntry, b: BookEntry) => (Big(a.p).lt(b.p) ? 1 : -1)),
            sell: Object.values(sell).sort((a: BookEntry, b: BookEntry) => (Big(a.p).gt(b.p) ? 1 : -1)),
          };
          this.mapMarket.set(contract, m);
        } catch (error: any) {
          Logger.warn(error);
          reject(error);
        }
      });

      resolve(true);
    });
  }
}
