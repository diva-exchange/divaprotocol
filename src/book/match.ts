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
export type mRecord = {
  pk: string;
  id: number;
  p: string;
  a: string;
};

export type tMatch = {
  buy: mRecord;
  sell: mRecord;
};

export type matchBook = Map<string, Array<tMatch>>;

export class Match {
  private readonly _matchBook: matchBook;
  private static mb: Match;

  static make(): Match {
    if (!this.mb) {
      this.mb = new Match();
    }
    return this.mb;
  }

  private constructor() {
    this._matchBook = new Map<string, Array<tMatch>>();
  }

  public getMatchMap(): matchBook {
    return this._matchBook;
  }

  public addMatch(
    contract: string,
    buyOrigin: string,
    buyOriginId: number,
    buyPrice: string,
    sellOrigin: string,
    sellOriginId: number,
    sellPrice: string,
    amount: string
  ) {
    const mrBuy: mRecord = {
      pk: buyOrigin,
      id: buyOriginId,
      p: buyPrice,
      a: amount,
    };
    const mrSell: mRecord = {
      pk: sellOrigin,
      id: sellOriginId,
      p: sellPrice,
      a: amount,
    };
    const m: tMatch = { buy: mrBuy, sell: mrSell };
    if (!this._matchBook.has(contract)) {
      this._matchBook.set(contract, new Array<tMatch>());
    }
    this._matchBook.get(contract)!.push(m);
  }
}
