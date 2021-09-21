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
import base64url from 'base64-url';
import { Book, tBook } from './book';
import { Validation } from '../net/validation';
import { Logger } from '../util/logger';
import { MarketBook, tMarketBook } from './marketBook';

type tBuySell = 'buy' | 'sell';

export class OrderBook {
  private readonly config: Config;
  private readonly arrayNostro: { [contract: string]: Book } = {};
  private readonly arrayMarket: { [contract: string]: MarketBook } = {};
  private static ob: OrderBook;

  static async make(config: Config): Promise<OrderBook> {
    if (!this.ob) {
      this.ob = new OrderBook(config);
      await this.ob.populateCompleteOrderBookFromChain();
    }
    return this.ob;
  }

  private constructor(config: Config) {
    this.config = config;
    this.config.contracts_array.forEach((contract) => {
      this.arrayNostro[contract] = Book.make(contract);
      this.arrayMarket[contract] = MarketBook.make(contract);
    });
  }

  public addNostro(
    id: number,
    contract: string,
    type: tBuySell,
    price: number,
    amount: number
  ): void {
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

  public deleteNostro(
    id: number,
    contract: string,
    type: 'buy' | 'sell',
    price: number,
    amount: number
  ): void {
    if (!this.arrayNostro[contract]) {
      throw new Error('OrderBook.update(): invalid contract');
    }
    switch (type) {
      case 'buy':
        this.arrayNostro[contract].deleteBuy(id, price, amount);
        break;
      case 'sell':
        this.arrayNostro[contract].deleteSell(id, price, amount);
        break;
      default:
        throw new Error('OrderBook.update(): invalid type');
    }
  }

  public async updateMarket(contract: string): Promise<void> {
    if (!this.arrayMarket[contract]) {
      throw new Error('OrderBook.update(): invalid contract');
    }
    const currentState: string = await this.getState();
    if (currentState) {
      this.arrayMarket[contract] = MarketBook.make(contract);
      const allData = [...JSON.parse(currentState)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 4);
        if (
          keyArray[1] === 'DivaExchange' &&
          keyArray[2] === 'OrderBook' &&
          keyArray[3] === contract
        ) {
          try {
            const book: tBook = JSON.parse(base64url.decode(element.value));
            if (Validation.make().validateBook(book)) {
              book.buy.forEach((r) => {
                this.arrayMarket[book.contract].buy(r.p, r.a);
              });
              book.sell.forEach((r) => {
                this.arrayMarket[book.contract].sell(r.p, r.a);
              });
            }
          } catch (error: any) {
            Logger.error(error);
          }
        }
      });
    }
  }

  public getNostro(contract: string): tBook {
    if (!this.arrayNostro[contract]) {
      throw Error('OrderBook.getNostro(): Unsupported contract');
    }
    return this.arrayNostro[contract].get();
  }

  public getMarket(contract: string): tMarketBook {
    if (!this.arrayMarket[contract]) {
      throw Error('OrderBook.getMarket(): Unsupported contract');
    }
    return this.arrayMarket[contract].get();
  }

  private async populateCompleteOrderBookFromChain(): Promise<void> {
    const data: string = await this.getState();
    if (data) {
      const allData = [...JSON.parse(data)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 4);
        if (
          keyArray[1] === 'DivaExchange' &&
          keyArray[2] === 'OrderBook' &&
          this.config.contracts_array.includes(keyArray[3])
        ) {
          try {
            const book: tBook = JSON.parse(base64url.decode(element.value));
            const channel =
              keyArray[0] === this.config.my_public_key ? 'nostro' : 'market';
            if (Validation.make().validateBook(book)) {
              if (channel === 'nostro') {
                book.buy.forEach((r) => {
                  this.arrayNostro[book.contract].buy(r.id, r.p, r.a);
                });
                book.sell.forEach((r) => {
                  this.arrayNostro[book.contract].sell(r.id, r.p, r.a);
                });
              }
              book.buy.forEach((r) => {
                this.arrayMarket[book.contract].buy(r.p, r.a);
              });
              book.sell.forEach((r) => {
                this.arrayMarket[book.contract].sell(r.p, r.a);
              });
            }
          } catch (error: any) {
            Logger.error(error);
          }
        }
      });
    }
  }

  private getState(): Promise<string> {
    const url: string = this.config.url_api_chain + '/state/';
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        if (error || res.statusCode !== 200) {
          reject(error || res.statusCode);
        }
        resolve(data);
      });
    });
  }
}
