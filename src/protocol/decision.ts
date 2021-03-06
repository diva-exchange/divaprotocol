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
import base64url from "base64-url";

export class Decision {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  public auctionLockedContracts: Map<string, number> = new Map<
    string,
    number
  >();
  public auctionBlockHeight: number = Number.MAX_SAFE_INTEGER;

  static async make(config: Config): Promise<Decision> {
    const d = new Decision(config);
    d.orderBook = await Orderbook.make(config);
    return d;
  }

  private constructor(config: Config) {
    this.config = config;
    this.config.contracts_array.forEach((contract) => {
      this.setAuctionLockedContracts(contract);
    });
  }

  public async process(contract: string, blockHeight: number): Promise<void> {
    if (
      !this.auctionLockedContracts.has(contract) &&
      (await this.isMatch(contract))
    ) {
      console.log('match happened on: ' + blockHeight + 'block height!');
      this.sendDecisionToChain(contract, blockHeight);
    }
  }

  public async setAuctionLockedContracts(contract: string): Promise<void> {
    if (this.auctionLockedContracts.has(contract)) return;
    const lastBlock: BlockStruct = await this.getLastBlock();
    const states: string = await this.getState();
    if (states) {
      const allData = [...JSON.parse(states)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 5);
        if (
          element.key.startsWith('decision:DivaExchange:Auction:') &&
          element.value === 'taken'
        ) {
          if (!isNaN(Number(keyArray[4]))) {
            const bh = Number(keyArray[4]);
            if (bh + this.config.waitingPeriod > lastBlock.height) {
              this.auctionLockedContracts.set(keyArray[3], bh);
              this.auctionBlockHeight = Math.min(this.auctionBlockHeight, bh);
            }
          }
        }
      });
    }
  }

  private sendDecisionToChain(contract: string, blockheight: number): void {
    const nameSpace: string =
      'DivaExchange:Auction:' + contract + ':' + blockheight;
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [
        {
          seq: 1,
          command: 'decision',
          ns: nameSpace,
          base64url: base64url.encode(
              JSON.stringify('')
          ),
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
    let match: boolean = false;
    if (
      this.orderBook.getMarket(contract).buy.length < 1 ||
      this.orderBook.getMarket(contract).sell.length < 1
    ) {
      return match;
    }
    if (
      Big(
        this.marketSellInAscOrder(this.orderBook.getMarket(contract))[0].p
      ).toNumber() <=
      Big(
        this.marketBuyInDescOrder(this.orderBook.getMarket(contract))[0].p
      ).toNumber()
    ) {
      match = true;
    }
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
    marketBook.sell.sort((a, b) =>
      a.p.padStart(21, '0') > b.p.padStart(21, '0') ? 1 : -1
    );
    if (marketBook.sell.length > 0) {
      return marketBook.sell;
    }
    return [];
  }

  public marketBuyInDescOrder(marketBook: tMarketBook): Array<tRecord> {
    marketBook.buy.sort((a, b) =>
      a.p.padStart(21, '0') > b.p.padStart(21, '0') ? -1 : 1
    );
    if (marketBook.buy.length > 0) {
      return marketBook.buy;
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
