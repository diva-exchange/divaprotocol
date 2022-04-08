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
import { Orderbook } from '../book/orderbook';
import { Logger } from '../util/logger';
import get from 'simple-get';
import { BlockStruct } from './struct';
import { tMarketBook, tRecord } from '../book/market';
import { Big } from 'big.js';

export class Decision {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  private static d: Decision;

  static async make(config: Config): Promise<Decision> {
    if (!this.d) {
      this.d = new Decision(config);
    }
    this.d.orderBook = await Orderbook.make(config);
    return this.d;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public async process(contract: string, blockHeight: number): Promise<void> {
    const mapOfRBH: Map<string, number> = await this.getAuctionRestrictBlockHeight();
    const auctionRestrictBlockHeight: number = mapOfRBH.get(contract) || 0;
    if (blockHeight > auctionRestrictBlockHeight && (await this.isMatch(contract))) {
      console.log('match happened on: ' + blockHeight + 'block height!');
      this.sendDecisionToChain(contract, blockHeight);
    }
  }

  private sendDecisionToChain(contract: string, blockHeight: number): void {
    const nameSpace: string = this.config.ns_first_part + this.config.ns_auction + contract + ':' + blockHeight;
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [
        {
          seq: 1,
          command: this.config.decision,
          ns: nameSpace,
          d: '',
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

  private async isMatch(contract: string): Promise<boolean> {
    const match: boolean = false;
    /*
    if (this.orderBook.getMarket(contract).buy.length < 1 || this.orderBook.getMarket(contract).sell.length < 1) {
      return match;
    }
    if (
      Big(this.marketSellInAscOrder(this.orderBook.getMarket(contract))[0].p).toNumber() <=
      Big(this.marketBuyInDescOrder(this.orderBook.getMarket(contract))[0].p).toNumber()
    ) {
      match = true;
    }
*/
    return match;
  }

  private getLastBlock(): Promise<BlockStruct> {
    const url: string = this.config.url_api_chain + '/block/latest/';
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        if (error || res.statusCode !== 200) {
          reject(error || res.statusCode);
        }
        resolve(JSON.parse(data.toString()));
      });
    });
  }

  public marketSellInAscOrder(marketBook: tMarketBook): Array<tRecord> {
    marketBook.sell.sort((a, b) => (a.p.padStart(21, '0') > b.p.padStart(21, '0') ? 1 : -1));
    if (marketBook.sell.length > 0) {
      return marketBook.sell;
    }
    return [];
  }

  public marketBuyInDescOrder(marketBook: tMarketBook): Array<tRecord> {
    marketBook.buy.sort((a, b) => (a.p.padStart(21, '0') > b.p.padStart(21, '0') ? -1 : 1));
    if (marketBook.buy.length > 0) {
      return marketBook.buy;
    }
    return [];
  }

  private getState(): Promise<string> {
    const url: string =
      this.config.url_api_chain + '/state/search/' + this.config.decision_taken + this.config.ns_first_part;
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        if (error || res.statusCode !== 200) {
          reject(error || res.statusCode);
        }
        resolve(data);
      });
    });
  }

  public async getAuctionRestrictBlockHeight(): Promise<Map<string, number>> {
    const mapOfRestrictBlockHeight: Map<string, number> = new Map<string, number>();
    const mapOfSettlementsBlockHeight: Map<string, number> = new Map<string, number>();
    const states: string = await this.getState();
    if (states) {
      const allData = [...JSON.parse(states)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 6);
        if (
          element.key.startsWith(this.config.decision_taken + this.config.ns_first_part) &&
          this.config.contracts_array.includes(keyArray[4])
        ) {
          if (!isNaN(Number(keyArray[5]))) {
            const contract = keyArray[4].toString();
            const bh = Number(keyArray[5]);
            if (keyArray[3] == this.config.ns_auction.slice(0, -1)) {
              const currentRBH = mapOfRestrictBlockHeight.get(contract) || 0;
              mapOfRestrictBlockHeight.set(contract, Math.max(currentRBH, bh + this.config.waitingPeriod));
            }
            if (keyArray[3] == this.config.ns_settlement.slice(0, -1)) {
              const currentSBH = mapOfSettlementsBlockHeight.get(contract) || 0;
              mapOfSettlementsBlockHeight.set(contract, Math.max(currentSBH, bh));
            }
          }
        }
      });
      mapOfRestrictBlockHeight.forEach((value, contract) => {
        const sbh = mapOfSettlementsBlockHeight.get(contract) || 0;
        if (sbh > value) {
          mapOfRestrictBlockHeight.delete(contract);
        }
      });
    }
    return mapOfRestrictBlockHeight;
  }
}
