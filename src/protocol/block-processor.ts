/**
 * Copyright (C) 2021-2022 diva.exchange
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
import { BlockStruct } from './struct';
import { Orderbook } from '../book/orderbook';
import { SubscriptionManager } from './subscription-manager';
import { Decision } from './decision';
import { Settlement } from './settlement';
import get from 'simple-get';
import Big from 'big.js';
import { Logger } from '../util/logger';

export class BlockProcessor {
  private readonly config: Config;
  private orderbook: Orderbook = {} as Orderbook;
  private subscriptionManager: SubscriptionManager = {} as SubscriptionManager;
  private decision: Decision = {} as Decision;
  private settlement: Settlement = {} as Settlement;

  static async make(config: Config): Promise<BlockProcessor> {
    const f = new BlockProcessor(config);
    f.orderbook = await Orderbook.make(config);
    f.subscriptionManager = await SubscriptionManager.make();
    /*
    f.decision = await Decision.make(config);
    f.settlement = await Settlement.make(config);
*/
    return f;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public process(block: BlockStruct) {
    const arrayOrderBookUpdates = [];
    for (const t of block.tx) {
      for (const c of t.commands) {
        if (c.command === 'data' && c.ns.startsWith(this.config.ns_first_part + this.config.ns_order_book)) {
          arrayOrderBookUpdates.push(c.ns.split(':')[2] || '');
        }
/*
        if (
          c.command === this.config.decision &&
          c.ns.startsWith(this.config.ns_first_part + this.config.ns_settlement)
        ) {
          const keyArray: Array<string> = c.ns.toString().split(':', 4);
          if (this.config.contracts_array.includes(keyArray[2]) && (await this.settlementTaken(c.ns))) {
            this.settlement.settlementHappenedProcess(keyArray[2]);
          }
        }
*/
      }

      // check for settlement
      //await this.settlement.process(block.height);
    }

    arrayOrderBookUpdates.forEach(async (contract) => {
      if (contract && (await this.orderbook.fetchOrderBook(contract))) {
        const m = this.orderbook.getMarket(contract);
        this.subscriptionManager.broadcast(contract, 'market', m);

        // match
        if (this.orderbook.hasMatch(contract)) {
          Logger.trace(`Match: ${contract} ${m.buy[0].p} >= ${m.sell[0].p}; Auction height: ${block.height + 10}`);
          //@FIXME height + 10
          this.auction(contract, block.height + 10);
        }
      }
    });
  }

  private auction(contract: string, blockHeight: number): void {
    const nameSpace: string = this.config.ns_first_part + this.config.ns_auction + contract;
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [
        {
          seq: 1,
          command: this.config.decision,
          ns: nameSpace,
          h: blockHeight,
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

  private settlementTaken(ns: string): Promise<boolean> {
    let response: boolean = false;
    const url: string = this.config.url_api_chain + '/state/search/' + this.config.decision_taken + ns;
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any) => {
        if (error || res.statusCode !== 200) {
          reject(error || res.statusCode);
          response = false;
        }
        if (res.statusCode === 200) {
          response = true;
        }
        resolve(response);
      });
    });
  }
}
