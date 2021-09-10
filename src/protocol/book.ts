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

import { Big } from 'big.js';

const REGEX_CONTRACT = '^[A-Z0-9]{2,6}_[A-Z0-9]{2,6}$';

const TYPE_BUY = 'buy';
const TYPE_SELL = 'sell';

const PRECISION = 8;

export type tRecord = {
  id: number;
  p: string;
  a: string;
};

export type tBook = {
  contract: string;
  channel: string;
  buy: Array<tRecord>;
  sell: Array<tRecord>;
};

export class Book {
  private readonly contract: string;
  private readonly channel: string;

  private mapBuy: Map<number, Map<string, string>> = new Map();
  private mapSell: Map<number, Map<string, string>> = new Map();

  static make(contract: string, channel: string): Book {
    if (!contract.match(REGEX_CONTRACT)) {
      throw new Error('Book.make(): invalid contract');
    }
    return new Book(contract, channel);
  }

  private constructor(contract: string, channel: string) {
    this.contract = contract;
    this.channel = channel;
  }

  buy(id: number, price: string | number, amount: string | number) {
    this.set(id, TYPE_BUY, price, amount);
  }

  sell(id: number, price: string | number, amount: string | number) {
    this.set(id, TYPE_SELL, price, amount);
  }

  deleteBuy(id: number, price: string | number, amount: string | number) {
    if (this.mapBuy.size > 0 && this.mapBuy.has(id)) {
      //@FIXME remove ts-ignore
      // @ts-ignore
      const newAmount = new Big(this.mapBuy.get(id).get(price) || '0')
        .minus(amount)
        .toFixed(PRECISION);
      if (new Big(newAmount).toNumber() > 0) {
        this.set(id, TYPE_BUY, price, newAmount);
      } else {
        this.mapBuy.delete(id);
      }
    }
  }

  deleteSell(id: number, price: string | number, amount: string | number) {
    if (this.mapSell.size > 0 && this.mapSell.has(id)) {
      //@FIXME remove ts-ignore
      // @ts-ignore
      const newAmount = new Big(this.mapSell.get(id).get(price) || '0')
        .minus(amount)
        .toFixed(PRECISION);
      if (new Big(newAmount).toNumber() > 0) {
        this.set(id, TYPE_BUY, price, newAmount);
      } else {
        this.mapSell.delete(id);
      }
    }
  }

  private set(
    id: number,
    type: string,
    price: string | number,
    amount: string | number
  ) {
    switch (type) {
      case TYPE_BUY:
        return this.mapBuy.set(
          id,
          new Map().set(
            new Big(price).toFixed(PRECISION),
            new Big(amount).toFixed(PRECISION)
          )
        );
      case TYPE_SELL:
        return this.mapSell.set(
          id,
          new Map().set(
            new Big(price).toFixed(PRECISION),
            new Big(amount).toFixed(PRECISION)
          )
        );
      default:
        throw new Error('Book.set(): invalid type');
    }
  }

  get(): tBook {
    const buy: Array<tRecord> = [];
    const sell: Array<tRecord> = [];

    this.mapBuy.forEach((map, id) => {
      map.forEach((amount, price) => {
        buy.push({ id: id, p: price, a: amount });
      });
    });
    this.mapSell.forEach((map, id) => {
      map.forEach((amount, price) => {
        sell.push({ id: id, p: price, a: amount });
      });
    });

    return {
      contract: this.contract,
      channel: this.channel,
      buy: buy,
      sell: sell,
    };
  }
}
