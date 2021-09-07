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

type tRecord = {
  price: string;
  amount: string;
};

export type tBook = {
  contract: string;
  buy: Array<tRecord>;
  sell: Array<tRecord>;
};

export class Book {
  private readonly contract: string;

  private mapBuy: Map<string, string> = new Map();
  private mapSell: Map<string, string> = new Map();

  static make(contract: string): Book {
    if (!contract.match(REGEX_CONTRACT)) {
      throw new Error('Book.make(): invalid contract');
    }
    return new Book(contract);
  }

  private constructor(contract: string) {
    this.contract = contract;
  }

  buy(price: string | number, amount: string | number) {
    this.set(TYPE_BUY, price, amount);
  }

  sell(price: string | number, amount: string | number) {
    this.set(TYPE_SELL, price, amount);
  }

  private set(
    type: string,
    price: string | number,
    amount: string | number
  ) {
    let book;
    switch (type) {
      case TYPE_BUY:
        book = this.mapBuy;
        break;
      case TYPE_SELL:
        book = this.mapSell;
        break;
      default:
        throw new Error('Book.set(): invalid status/type');
    }

    price = new Big(price).toFixed(PRECISION);
    amount = new Big(amount).toFixed(PRECISION);

    const a = new Big(book.get(price) || '0').toFixed(PRECISION);
    book.set(price, new Big(a).plus(amount).toFixed(PRECISION));
  }

  get(): tBook {
    const buy: Array<tRecord> = [];
    const sell: Array<tRecord> = [];

    this.mapBuy.forEach((v, k) => {
      buy.push({ price: k, amount: v });
    });
    this.mapSell.forEach((v, k) => {
      sell.push({ price: k, amount: v });
    });

    return { contract: this.contract, buy: buy, sell: sell };
  }
}
