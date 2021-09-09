/**
 * Copyright (C) 2021 diva.exchange
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

import { Config } from '../config';
import get from 'simple-get';
import { Logger } from '../logger';
import base64url from 'base64-url';
import { Book, tBook } from './book';
import { Validation } from '../net/validation';

type tBuySell = 'buy' | 'sell';

export class OrderBook {
  private readonly config: Config;
  private readonly arrayNostro: { [contract: string]: Book } = {};
  private readonly arrayMarket: { [contract: string]: Book } = {};

  static async make(config: Config): Promise<OrderBook> {
    const ob = new OrderBook(config);
    await ob.fetchAllFromChain();
    return ob;
  }

  private constructor(config: Config) {
    this.config = config;

    this.config.contracts_array.forEach((contract) => {
      this.arrayNostro[contract] = Book.make(contract);
      this.arrayMarket[contract] = Book.make(contract);
    });
  }

  update(
    id: number,
    contract: string,
    type: tBuySell,
    price: number,
    amount: number
  ) {
    if (!this.arrayNostro[contract]) {
      throw new Error('OrderBook.update(): invalid contract');
    }
    switch (type) {
      case 'buy':
        this.arrayNostro[contract].buy(id, price, amount);
        break;
      case 'sell':
        this.arrayNostro[contract].sell(id, price, amount);
        break;
      default:
        throw new Error('OrderBook.update(): invalid type');
    }
  }

  getNostro(contract: string): tBook {
    if (!this.arrayNostro[contract]) {
      throw Error('OrderBook.getNostro(): Unsupported contract');
    }
    return this.arrayNostro[contract].get();
  }

  getMarket(contract: string): tBook {
    if (!this.arrayMarket[contract]) {
      throw Error('OrderBook.getMarket(): Unsupported contract');
    }
    return this.arrayMarket[contract].get();
  }

  private async loadOrderBookFromChain(): Promise<void> {
    for (const contract of Object.keys(this.arrayNostro)) {
      try {
        await this.fetch(contract);
      } catch (error: any) {
        //@FIXME logging
        Logger.trace(error);
      }
    }
  }

  private async fetch(contract: string): Promise<void> {
    const url: string =
      this.config.url_api_chain +
      '/state/' +
      this.config.my_public_key +
      ':DivaExchange:OrderBook:' +
      contract;
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        if (error || res.statusCode !== 200) {
          reject(error || res.statusCode);
        }
        try {
          const book: tBook = JSON.parse(base64url.decode(data));
          if (Validation.make().validateBook(book)) {
            book.buy.forEach((r) => {
              this.arrayNostro[book.contract].buy(r.id, r.p, r.a);
            });
            book.sell.forEach((r) => {
              this.arrayNostro[book.contract].sell(r.id, r.p, r.a);
            });
          }
        } catch (error: any) {
          reject(error);
        }
        resolve();
      });
    });
  }

  private async fetchAllFromChain(): Promise<void> {
    const url: string = this.config.url_api_chain + '/state/';
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        if (error || res.statusCode !== 200) {
          reject(error || res.statusCode);
        }
        if (data) {
          const allData = [...JSON.parse(data)];
          allData.forEach((element) => {
            const keyArray: Array<string> = element.key
              .toString()
              .split(':', 4);
            if (
              keyArray[1] === 'DivaExchange' &&
              keyArray[2] === 'OrderBook' &&
              this.config.contracts_array.includes(keyArray[3])
            ) {
              try {
                const book: tBook = JSON.parse(base64url.decode(element.value));
                if (Validation.make().validateBook(book)) {
                  if (keyArray[0] === this.config.my_public_key) {
                    book.buy.forEach((r) => {
                      this.arrayNostro[book.contract].buy(r.id, r.p, r.a);
                    });
                    book.sell.forEach((r) => {
                      this.arrayNostro[book.contract].sell(r.id, r.p, r.a);
                    });
                  }
                  book.buy.forEach((r) => {
                    this.arrayMarket[book.contract].buy(r.id, r.p, r.a);
                  });
                  book.sell.forEach((r) => {
                    this.arrayMarket[book.contract].sell(r.id, r.p, r.a);
                  });
                }
              } catch (error: any) {
                reject(error);
              }
            }
          });
        }
        resolve();
      });
    });
  }
}
