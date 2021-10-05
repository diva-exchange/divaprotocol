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
type tMatch = {
  contract: string;
  type: 'buy' | 'sell';
  amount: number | string;
  price: number | string;
  blockHeight: number;
};

export type matchBook = Map<number, Map<string, Map<number, tMatch>>>;

export class MatchBook {
  private readonly _matchMap: matchBook;
  public arrayOfMatchBlockHeights: Array<number> = [];
  private static mb: MatchBook;

  static make(): MatchBook {
    if (!this.mb) {
      this.mb = new MatchBook();
    }
    return this.mb;
  }

  private constructor() {
    this._matchMap = new Map();
  }

  public getMatchMap(): matchBook {
    return this._matchMap;
  }

  public addMatch(
    nostroId: number,
    origin: string,
    originId: number,
    contract: string,
    type: 'buy' | 'sell',
    amount: number | string,
    price: number | string,
    blockHeight: number
  ) {
    if (nostroId) {
      const o: tMatch = {
        contract: contract,
        type: type,
        amount: amount,
        price: price,
        blockHeight: blockHeight,
      };
      const match = new Map().set(originId, o);
      const matchOrigin = new Map().set(origin, match);

      if (this._matchMap.has(nostroId)) {
        const existingMatchMapValue = this._matchMap.get(nostroId) || new Map();
        if (existingMatchMapValue.has(origin)) {
          const existingMatchOrigin =
            existingMatchMapValue.get(origin) || new Map();
          existingMatchOrigin.set(originId, o);
        } else {
          existingMatchMapValue.set(origin, match);
        }
      } else {
        this._matchMap.set(nostroId, matchOrigin);
      }
      console.log(this._matchMap);
      console.log('---------------------');
      console.log(matchOrigin);
      console.log('match--------------------------------');
      console.log(match);

      this.arrayOfMatchBlockHeights.push(blockHeight);
    }
  }

  public deleteMatch(id: number): void {
    this._matchMap.delete(id);
  }
}
