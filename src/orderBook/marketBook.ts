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
  p: string;
  a: string;
};

export type tMarketBook = {
  contract: string;
  channel: string;
  buy: Array<tRecord>;
  sell: Array<tRecord>;
};

export class MarketBook {
  private readonly contract: string;

  private mapBuy: Map<string, string> = new Map();
  private mapSell: Map<string, string> = new Map();

  static make(contract: string): MarketBook {
    if (!contract.match(REGEX_CONTRACT)) {
      throw new Error('Book.make(): invalid contract');
    }
    return new MarketBook(contract);
  }

  private constructor(contract: string) {
    this.contract = contract;
  }

  public buy(
    price: string | number,
    amount: string | number
  ): void {
    this.set(TYPE_BUY, price, amount);
  }

  public sell(
    price: string | number,
    amount: string | number
  ): void {
    this.set(TYPE_SELL, price, amount);
  }

  private set(
    type: string,
    price: string | number,
    amount: string | number
  ): Map<string, string> {
    const convertedPrice = new Big(price).toFixed(PRECISION);
    const convertedAmount = new Big(amount).toFixed(PRECISION);
    switch (type) {
      case TYPE_BUY:
        const existingBuyAmount = this.mapBuy.get(convertedPrice);
        const newBuyAmount = new Big(existingBuyAmount || 0)
            .plus(convertedAmount)
            .toFixed(PRECISION);
        if (new Big(newBuyAmount).toNumber() > 0) {
          this.mapBuy.set(
              convertedPrice,
              newBuyAmount
          );
        } else {
          this.mapBuy.delete(convertedPrice);
        }
        return this.mapBuy;
      case TYPE_SELL:
        const existingSellAmount = this.mapSell.get(convertedPrice);
        const newSellAmount = new Big(existingSellAmount || 0)
            .plus(convertedAmount)
            .toFixed(PRECISION);
        if (new Big(newSellAmount).toNumber() > 0) {
          this.mapSell.set(
              convertedPrice,
              newSellAmount
          );
        } else {
          this.mapSell.delete(convertedPrice);
        }
        return this.mapSell;
      default:
        throw new Error('MarketBook.countNewPrice(): invalid type');
    }
  }

  public get(): tMarketBook {
    const buy: Array<tRecord> = [];
    const sell: Array<tRecord> = [];

    this.mapBuy.forEach((amount, price) => {
      buy.push({ p: price, a: amount });
    });
    this.mapSell.forEach((amount, price) => {
        sell.push({ p: price, a: amount });
    });

    return {
      contract: this.contract,
      channel: 'market',
      buy: buy,
      sell: sell,
    };
  }
}
