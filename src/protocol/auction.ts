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

import { Config } from '../config/config';
import { Match, mRecord } from '../book/match';
import { Decision } from './decision';
import get from 'simple-get';
import { Logger } from '../util/logger';
import { tNostro } from '../book/nostro';
import base64url from 'base64-url';
import { Validation } from '../net/validation';
import { Orderbook } from '../book/orderbook';
import { Big } from 'big.js';

export class Auction {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  private match: Match = {} as Match;
  private decision: Decision = {} as Decision;

  static async make(config: Config): Promise<Auction> {
    const a = new Auction(config);
    a.orderBook = await Orderbook.make(config);
    a.match = await Match.make();
    a.decision = await Decision.make(config);
    return a;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public settlement(currentBlockHeight: number) {
    this.decision.auctionLockedContracts.forEach(
      (bh: number, contract: string) => {
        if (currentBlockHeight >= bh + this.config.waitingPeriod) {
          this.populateMatchBook(contract).then(() => {
            this.sendSettlementToChain(contract);
          });
        }
      }
    );
  }

  async populateMatchBook(contract: string) {
    const sellCrossPrice: Number = this.getSellCrossLimit(contract);
    const buyCrossPrice: Number = this.getBuyCrossLimit(contract);
    const buyMRecordArray = new Array<mRecord>();
    const sellMRecordArray = new Array<mRecord>();

    const states: string = await this.getState();
    if (states) {
      const allData = [...JSON.parse(states)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 4);
        if (
          keyArray[0] === 'DivaExchange' &&
          keyArray[1] === 'OrderBook' &&
          keyArray[2] === contract
        ) {
          try {
            const book: tNostro = JSON.parse(base64url.decode(element.value));
            if (Validation.make().validateBook(book)) {
              book.buy.forEach((value) => {
                if (new Big(value.p).toNumber() >= buyCrossPrice) {
                  buyMRecordArray.push({
                    pk: keyArray[3],
                    id: value.id,
                    p: value.p,
                    a: value.a,
                  });
                }
              });
              book.sell.forEach((value) => {
                if (new Big(value.p).toNumber() <= sellCrossPrice) {
                  sellMRecordArray.push({
                    pk: keyArray[3],
                    id: value.id,
                    p: value.p,
                    a: value.a,
                  });
                }
              });
            }
          } catch (error: any) {
            Logger.error(error);
          }
        }
      });
    }
    //@TODO the logic of matching itself
    this.sortMRecords(buyMRecordArray).forEach((buyValue) => {
      this.sortMRecords(sellMRecordArray).forEach((sellValue) => {
        if (buyValue.p === sellValue.p) {
          console.log('match');
          //this.match.addMatch(...);
        }
      });
    });
  }

  private sendSettlementToChain(contract: string): void {
    const data = this.match.getMatchMap().get(contract) || '';
    const nameSpace: string = 'DivaExchange:Settlement:' + contract;
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [
        {
          seq: 1,
          command: 'decision',
          ns: nameSpace,
          data: data,
        },
      ],
      json: true,
    };
    get.concat(opts, (error: Error) => {
      if (error) {
        //@FIXME logging and error handling
        Logger.trace(error);
      }
    });
  }

  getSellCrossLimit(contract: string): Number {
    let sellCrossHigh: Number = 0;
    this.decision
      .marketSellInAscOrder(this.orderBook.getMarket(contract))
      .forEach((value) => {
        if (
          Big(value.p).toNumber() <=
          Big(
            this.decision.marketBuyInDescOrder(
              this.orderBook.getMarket(contract)
            )[0].p
          ).toNumber()
        ) {
          sellCrossHigh = Big(value.p).toNumber();
        }
      });
    return sellCrossHigh;
  }

  getBuyCrossLimit(contract: string): Number {
    let buyCrossLow: Number = 0;
    this.decision
      .marketBuyInDescOrder(this.orderBook.getMarket(contract))
      .forEach((value) => {
        if (
          Big(value.p).toNumber() >=
          Big(
            this.decision.marketSellInAscOrder(
              this.orderBook.getMarket(contract)
            )[0].p
          ).toNumber()
        ) {
          buyCrossLow = Big(value.p).toNumber();
        }
      });
    return buyCrossLow;
  }

  public sortMRecords(mRecordsArray: Array<mRecord>): Array<mRecord> {
    mRecordsArray.sort((a, b) => {
      if (a.p.padStart(21, '0') == b.p.padStart(21, '0')) {
        return a.id > b.id ? 1 : -1;
      } else {
        return a.p.padStart(21, '0') > b.p.padStart(21, '0') ? -1 : 1;
      }
    });
    if (mRecordsArray.length > 0) {
      return mRecordsArray;
    }
    return [];
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
