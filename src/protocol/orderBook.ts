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

  public static async make(config: Config): Promise<OrderBook> {
    const ob = new OrderBook(config);
    await ob.loadOrderBookFromChain();
    return ob;
  }

  private constructor(config: Config) {
    this.config = config;

    this.config.contracts_array.forEach((contract) => {
      this.arrayNostro[contract] = Book.make(contract);
    });
  }

  public updateBook(
    contract: string,
    type: tBuySell,
    price: number,
    amount: number
  ) {
    if (!this.arrayNostro[contract]) {
      throw new Error('OrderBook.updateBook(): invalid contract');
    }
    switch (type) {
      case 'buy':
        return this.arrayNostro[contract].buyUnconfirmed(price, amount);
      case 'sell':
        return this.arrayNostro[contract].sellUnconfirmed(price, amount);
    }
  }

  public get(contract: string): string {
    if (!this.arrayNostro[contract]) {
      throw Error('OrderBook.get(): Unsupported contract');
    }
    return JSON.stringify(this.arrayNostro[contract].get());
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

  private fetch(contract: string): Promise<void> {
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
              this.arrayNostro[book.contract].buyConfirmed(r.price, r.amount);
            });
            book.sell.forEach((r) => {
              this.arrayNostro[book.contract].sellConfirmed(r.price, r.amount);
            });
          }
        } catch (error: any) {
          reject(error);
        }
        resolve();
      });
    });
  }
}
