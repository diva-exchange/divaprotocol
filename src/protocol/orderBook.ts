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

import { Db } from '../db';
import Big from 'big.js';

export class OrderBook {
  private readonly db: Db;
  private readonly arrayBook: {
    [key: string]: { buy: Map<string, string>; sell: Map<string, string> };
  };

  public static make(db: Db): OrderBook {
    return new OrderBook(db);
  }

  private constructor(db: Db) {
    this.db = db;
    //@FIXME load the order books from the chain
    this.arrayBook = {
      BTC_ETH: { buy: new Map(), sell: new Map() },
      BTC_XMR: { buy: new Map(), sell: new Map() },
      BTC_ZEC: { buy: new Map(), sell: new Map() },
    };
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
}
