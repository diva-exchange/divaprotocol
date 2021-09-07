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

import {Big} from 'big.js';

const REGEX_CONTRACT = '^[A-Z0-9]{2,6}_[A-Z0-9]{2,6}$';

const STATUS_UNCONFIRMED = 0;
const STATUS_CONFIRMED = 0;
const TYPE_BUY = 'buy';
const TYPE_SELL = 'sell';

const PRECISION = 8;

type tRecord = {
  price: string;
  amount: string;
  status: number
};

export type tBook = {
  contract: string;
  buy: Array<tRecord>,
  sell: Array<tRecord>
}

export class Book {

  private readonly contract: string;

  private mapBuyConfirmed: Map<string, string> = new Map();
  private mapSellConfirmed: Map<string, string> = new Map();

  private mapBuyUnconfirmed: Map<string, string> = new Map();
  private mapSellUnconfirmed: Map<string, string> = new Map();

  static make(contract: string): Book {
    if (!contract.match(REGEX_CONTRACT)) {
      throw new Error('Book.make(): invalid contract');
    }
    return new Book(contract);
  }

  private constructor(contract: string) {
    this.contract = contract;
  }

  buyConfirmed(price: string | number, amount: string | number) {
    this.set(STATUS_CONFIRMED, TYPE_BUY, price, amount);
  }

  sellConfirmed(price: string | number, amount: string | number) {
    this.set(STATUS_CONFIRMED, TYPE_SELL, price, amount);
  }

  buyUnconfirmed(price: string | number, amount: string | number) {
    this.set(STATUS_UNCONFIRMED, TYPE_BUY, price, amount);
  }

  sellUnconfirmed(price: string | number, amount: string | number) {
    this.set(STATUS_UNCONFIRMED, TYPE_SELL, price, amount);
  }

  private set(status: number, type: string, price: string | number, amount: string | number) {
    let book;
    switch (status + type) {
      case STATUS_UNCONFIRMED + TYPE_BUY:
        book = this.mapBuyUnconfirmed;
        break;
      case STATUS_UNCONFIRMED + TYPE_SELL:
        book = this.mapSellUnconfirmed;
        break;
      case STATUS_CONFIRMED + TYPE_BUY:
        book = this.mapBuyConfirmed;
        break;
      case STATUS_CONFIRMED + TYPE_SELL:
        book = this.mapSellConfirmed;
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

    this.mapBuyConfirmed.forEach((v, k) => {
      buy.push({ price: k, amount: v, status: STATUS_CONFIRMED });
    });
    this.mapBuyUnconfirmed.forEach((v, k) => {
      buy.push({ price: k, amount: v, status: STATUS_UNCONFIRMED });
    });
    this.mapSellConfirmed.forEach((v, k) => {
      sell.push({ price: k, amount: v, status: STATUS_CONFIRMED });
    });
    this.mapSellUnconfirmed.forEach((v, k) => {
      sell.push({ price: k, amount: v, status: STATUS_UNCONFIRMED });
    });

    return { contract: this.contract, buy: buy, sell: sell };
  }

}
