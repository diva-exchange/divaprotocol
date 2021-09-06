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

const STATUS_ORDER_UNCONFIRMED = 0;
const STATUS_ORDER_CONFIRMED = 1;

export class OrderBook {
  private readonly config: Config;
  private readonly arrayBookNostro: {
    [key: string]: { buy: { [price: string]: { [status: number]: string } }; sell: { [price: string]: { [status: number]: string } } };
  };
  private readonly arrayBookMarket: {
    [key: string]: { buy: { [price: string]: string }; sell: { [price: string]: string } };
  };

  public static async make(config: Config): Promise<OrderBook> {
    const ob = new OrderBook(config);
    await ob.loadOrderBookFromChain();
    return ob;
  }

  private constructor(config: Config) {
    this.config = config;
    //@FIXME load the order books from the chain
    this.arrayBookNostro = {
      BTC_ETH: { buy: {}, sell: {}},
      BTC_XMR: { buy: {}, sell: {}},
      BTC_ZEC: { buy: {}, sell: {}},
    };

    this.arrayBookMarket = {
      BTC_ETH: { buy: {}, sell: {} },
      BTC_XMR: { buy: {}, sell: {} },
      BTC_ZEC: { buy: {}, sell: {} },
    };
  }

  public updateBook(
    contract: string,
    type: 'buy' | 'sell',
    price: number,
    amount: number
  ): void {
    if (!this.arrayBookNostro[contract]) {
      throw Error('OrderBook.updateBook(): Unsupported contract');
    }

    const newPrice: string = new Big(price).toFixed(this.config.precision);
    this.arrayBookNostro[contract][type][newPrice] = this.arrayBookNostro[contract][type][newPrice] || {};
    let newAmount: string = new Big(
      this.arrayBookNostro[contract][type][newPrice][STATUS_ORDER_UNCONFIRMED] || 0
    )
      .plus(amount)
      .toFixed(this.config.precision);

    Logger.trace(this.arrayBookNostro[contract][type]);
    this.arrayBookNostro[contract][type][newPrice][STATUS_ORDER_UNCONFIRMED] = new Big(amount).toFixed(this.config.precision);
  }

  public get(contract: string): string {
    if (!this.arrayBookNostro[contract]) {
      throw Error('OrderBook.get(): Unsupported contract');
    }
    return JSON.stringify({
      channel: 'nostro',
      contract: contract,
      buy: this.arrayBookNostro[contract].buy,
      sell: this.arrayBookNostro[contract].sell,
    });
  }

  public confirmOrder(contract: string) {
    //this.arrayBook[contract]['status'] = 1;
  }

  private async loadOrderBookFromChain(): Promise<void> {
    for (const contract of this.config.contracts_array) {
      try {
        await this.fetch(contract);
      } catch (error: any) {
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
        if (error) {
          reject(error);
        }
        if (res.statusCode === 200) {
          //@FIXME type any need to be solved
          const obj: { buy: { [price: string]: string }; sell: { [price: string]: string } } = JSON.parse(
              base64url.decode(data)
          );
          this.arrayBookNostro[contract].buy[1] = obj.buy;
          this.arrayBookNostro[contract].sell[1] = obj.sell;
        }
        resolve();
      });
    });
  }
}
