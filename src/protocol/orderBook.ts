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
import Big from 'big.js';
import get from 'simple-get';
import { Logger } from '../logger';
import base64url from 'base64-url';

export class OrderBook {
  private readonly config: Config;
  private readonly arrayBook: {
    [key: string]: { buy: Map<string, string>; sell: Map<string, string> };
  };

  public static make(config: Config): OrderBook {
    return new OrderBook(config);
  }

  private constructor(config: Config) {
    this.config = config;
    //@FIXME load the order books from the chain
    this.arrayBook = {
      BTC_ETH: { buy: new Map(), sell: new Map() },
      BTC_XMR: { buy: new Map(), sell: new Map() },
      BTC_ZEC: { buy: new Map(), sell: new Map() },
    };
    this.loadOrderBookFromChain();
  }

  public updateBook(
    contract: string,
    type: 'buy' | 'sell',
    price: number,
    amount: number
  ) {
    if (!this.arrayBook[contract]) {
      throw Error('OrderBook.updateBook(): Unsupported contract');
    }
    //@FIXME precision
    const newPrice: string = new Big(price).toFixed(9);
    const newAmount: string = new Big(
      this.arrayBook[contract][type].get(newPrice) || 0
    )
      .plus(amount)
      .toFixed(9);
    this.arrayBook[contract][type].set(newPrice, newAmount);
  }

  get(contract: string): {
    buy: Map<string, string>;
    sell: Map<string, string>;
  } {
    if (!this.arrayBook[contract]) {
      throw Error('OrderBook.get(): Unsupported contract');
    }
    return this.arrayBook[contract];
  }

  serialize(contract: string): string {
    if (!this.arrayBook[contract]) {
      throw Error('OrderBook.get(): Unsupported contract');
    }
    return JSON.stringify({
      buy: [...this.arrayBook[contract].buy.entries()],
      sell: [...this.arrayBook[contract].sell.entries()],
    });
  }

  private async loadOrderBookFromChain() {
    for (const contract of this.config.contracts_array) {
      const url: string =
        this.config.url_api_chain +
        '/state/' +
        this.config.my_public_key +
        ':DivaExchange:OrderBook:' +
        contract;
      new Promise((resolve, reject) => {
        get.concat(url, (error: Error, res: any, data: any) => {
          if (error) {
            Logger.trace(error);
            reject(error);
            return;
          }
          if (res.statusCode == 200) {
            //@FIXME type any need to be solved
            const obj: { buy: any; sell: any } = JSON.parse(
              base64url.decode(data)
            );
            this.arrayBook[contract].buy = new Map(obj.buy);
            this.arrayBook[contract].sell = new Map(obj.sell);
          }
          resolve(data);
        });
      });
    }
  }
}
