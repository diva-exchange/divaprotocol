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

type Book = {
  buy: Array<BookRecord>;
  sell: Array<BookRecord>;
};

type BookRecord = {
  id: string;
  t: number; // unix time in milliseconds
  p: string;
  a: string;
  h: string;
};

type Market = {
  buy: Array<MarketRecord>;
  sell: Array<MarketRecord>;
};

type MarketRecord = {
  t: number; // unix time in milliseconds
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
  private mapMarket: Map<string, Market>;
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

  public getMarket(contract: string): Market {
    return this.mapMarket.get(contract) || { buy: [], sell: [] };
  }

  public hasMatch(contract: string): Boolean {
    return this.mapMatch.has(contract);
  }

  public getMatch(contract: string): Book {
    return this.mapMatch.get(contract) || {} as Book;
  }

  public add(id: string, contract: string, type: string, price: number, amount: number) {
    id = id ? id.trim() : '';
    id = id || nanoid();
    const b = this.mapBook.get(contract);
    if (!b) {
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
      book.buy.sort((a: BookRecord, b: BookRecord) => (Big(a.p).lt(b.p) ? 1 : Big(a.p).eq(b.p) && a.t > b.t ? 1 : -1));
    } else {
      book.sell.push({ id: id, t: Date.now(), p: p, a: a, h: h });
      book.sell.sort((a: BookRecord, b: BookRecord) => (Big(a.p).gt(b.p) ? 1 : Big(a.p).eq(b.p) && a.t > b.t ? 1 : -1));
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
    id = id ? id.trim() : '';
    const b = this.mapBook.get(contract);
    if (!id || !b) {
      throw new Error('Orderbook.delete(): invalid id or contract');
    }
    const book = b.get(this.config.my_public_key);
    if (!book) {
      return;
    }

    if (type === this.BUY) {
      book.buy = book.buy.filter((r: BookRecord) => r.id !== id);
    } else {
      book.sell = book.sell.filter((r: BookRecord) => r.id !== id);
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
        const hash = this.mapHash.get(contract) || '';
        const md5 = crypto.createHash('md5').update(data).digest('base64');
        //@FIXME loggging
        Logger.trace(`${contract}: hash: ${hash} - md5: ${md5}`);

        if (hash === md5) {
          resolve(false);
        }
        this.mapHash.set(contract, md5);

        let mapBook: Map<string, Book> = new Map();
        try {
          mapBook = this.processOrderBook(JSON.parse(data));
        } catch (error: any) {
          Logger.warn(`JSON parsing failed fetchOrderBook(${contract})`);
          Logger.warn(error);
          resolve(false);
        }

        this.mapBook.set(contract, mapBook);

        const buy: { [price: string]: MarketRecord } = {};
        const sell: { [price: string]: MarketRecord } = {};

        // update market
        let aMatchBuy: Array<BookRecord> = [];
        let aMatchSell: Array<BookRecord> = [];
        mapBook.forEach((v: Book) => {
          v.buy.forEach((_b) => {
            buy[_b.p] = buy[_b.p] || { t: 0, p: _b.p, a: '0' };
            buy[_b.p].a = Big(buy[_b.p].a).plus(_b.a).toFixed(this.config.decimalPrecision);
            buy[_b.p].t = buy[_b.p].t > _b.t ? buy[_b.p].t : _b.t;
          });
          aMatchBuy = aMatchBuy.concat(v.buy);

          v.sell.forEach((_b) => {
            sell[_b.p] = sell[_b.p] || { t: 0, p: _b.p, a: '0' };
            sell[_b.p].a = Big(sell[_b.p].a).plus(_b.a).toFixed(this.config.decimalPrecision);
            sell[_b.p].t = sell[_b.p].t > _b.t ? sell[_b.p].t : _b.t;
          });
          aMatchSell = aMatchSell.concat(v.sell);
        });

        // sorting by price, then by md5 hash - this is a protocol decision and not affected by
        // preimage / collision attacks on md5
        aMatchBuy.sort((a: BookRecord, b: BookRecord) =>
          Big(a.p).lt(b.p) ? 1 : Big(a.p).eq(b.p) && a.h >= b.h ? 1 : -1
        );
        aMatchSell.sort((a: BookRecord, b: BookRecord) =>
          Big(a.p).gt(b.p) ? 1 : Big(a.p).eq(b.p) && a.h >= b.h ? 1 : -1
        );

        const m: Market = {
          buy: Object.values(buy).sort((a: MarketRecord, b: MarketRecord) => (Big(a.p).lt(b.p) ? 1 : -1)),
          sell: Object.values(sell).sort((a: MarketRecord, b: MarketRecord) => (Big(a.p).gt(b.p) ? 1 : -1)),
        };
        this.mapMarket.set(contract, m);

        // matching
        this.mapMatch.delete(contract);
        const match: Book = { buy: [], sell: [] };
        do {
          if (aMatchBuy[0] && aMatchSell[0] && Big(aMatchBuy[0].p).gte(aMatchSell[0].p)) {
            match.buy.push(aMatchBuy.shift() as BookRecord);
            match.sell.push(aMatchSell.shift() as BookRecord);
          } else if (aMatchBuy[0] && match.sell[0] && Big(aMatchBuy[0].p).gte(match.sell[0].p)) {
            match.buy.push(aMatchBuy.shift() as BookRecord);
          } else if (aMatchSell[0] && match.buy[0] && Big(match.buy[0].p).gte(aMatchSell[0].p)) {
            match.sell.push(aMatchSell.shift() as BookRecord);
          } else {
            match.buy.length && match.sell.length && this.mapMatch.set(contract, match);
            break;
          }
        } while (true);

        resolve(true);
      });
    });
  }

  private processOrderBook(ob: Array<KeyValue>): Map<string, Book> {
    // upper and lower limits for t
    const tMax = Date.now();
    const tMin = tMax - (10 * 24 * 60 * 60 * 1000); // older than 10 days
    const mapBook: Map<string, any> = new Map();

    ob.forEach((v) => {
      const bk = JSON.parse(v.value);
      const pk = v.key.split(':')[3];
      if (pk.length && (bk.buy.length || bk.sell.length)) {
        bk.buy = bk.buy.filter((v: BookRecord) => {
          // data validation
          const t = Number(v.t) || 0;
          return v.id && t > 0 && t >= tMin && t <= tMax && Big(v.p || 0).toNumber() > 0 && Big(v.a || 0).toNumber() > 0;
        }).map((v: BookRecord) => {
          const p = Big(v.p).toFixed(this.config.decimalPrecision);
          const a = Big(v.a).toFixed(this.config.decimalPrecision);
          return {
            id: v.id,
            t: Number(v.t),
            p: p,
            a: a,
            h: crypto.createHash('md5').update(pk + a).digest('base64'),
          }
        });
        // sorting by price, then by md5 hash - this is a protocol decision and not affected by
        // preimage / collision attacks on md5
        bk.buy.sort((a: BookRecord, b: BookRecord) =>
          Big(a.p).lt(b.p) ? 1 : Big(a.p).eq(b.p) && a.h >= b.h ? 1 : -1
        );

        bk.sell = bk.sell.filter((v: BookRecord) => {
          // data validation
          const t = Number(v.t) || 0;
          return v.id && t > 0 && t >= tMin && t <= tMax && Big(v.p || 0).toNumber() > 0 && Big(v.a || 0).toNumber() > 0;
        }).map((v: BookRecord) => {
          const p = Big(v.p).toFixed(this.config.decimalPrecision);
          const a = Big(v.a).toFixed(this.config.decimalPrecision);
          return {
            id: v.id,
            t: Number(v.t),
            p: p,
            a: a,
            h: crypto.createHash('md5').update(pk + a).digest('base64'),
          }
        });
        // sorting by price, then by md5 hash - this is a protocol decision and not affected by
        // preimage / collision attacks on md5
        bk.sell.sort((a: BookRecord, b: BookRecord) =>
          Big(a.p).gt(b.p) ? 1 : Big(a.p).eq(b.p) && a.h >= b.h ? 1 : -1
        );
        mapBook.set(pk, { buy: bk.buy, sell: bk.sell });
      }
    });

    return mapBook;
  }
}
