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
import { BlockStruct } from './struct';
import { Orderbook } from '../book/orderbook';
import WebSocket from 'ws';
import { SubscribeManager, iSubscribe } from './subscribe-manager';
import { tNostro } from '../book/nostro';
import { Decision } from './decision';
import { Settlement } from './settlement';
import { MessageProcessor } from './message-processor';
import get from 'simple-get';

export class BlockProcessor {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;
  private decision: Decision = {} as Decision;
  private settlement: Settlement = {} as Settlement;
  private messageProcessor: MessageProcessor = {} as MessageProcessor;

  static async make(config: Config): Promise<BlockProcessor> {
    const f = new BlockProcessor(config);
    f.orderBook = await Orderbook.make(config);
    f.subscribeManager = await SubscribeManager.make();
    f.decision = await Decision.make(config);
    f.settlement = await Settlement.make(config);
    f.messageProcessor = await MessageProcessor.make(config);
    return f;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public async process(block: BlockStruct): Promise<void> {
    for (const t of block.tx) {
      for (const c of t.commands) {
        //@FIXME literals -> constants or config
        if (
          c.command === 'data' &&
          c.ns.startsWith('DivaExchange:OrderBook:')
        ) {
          const decodedJsonData: tNostro = JSON.parse(c.d);

          const contract: string = decodedJsonData.contract;

          // fill marketBook
          await this.orderBook.updateMarket(contract);

          // check for decision
          await this.decision.process(contract, block.height);

          // subscription
          const sub: Map<WebSocket, iSubscribe> =
            this.subscribeManager.getSubscriptions();

          sub.forEach((subscribe, ws) => {
            if (subscribe.market.has(contract)) {
              const marketBook = this.orderBook.getMarket(contract);
              ws.send(JSON.stringify(marketBook));
            }
          });
        }
        if (
          c.command === 'decision' &&
          c.ns.startsWith('DivaExchange:Settlement:')
        ) {
          const keyArray: Array<string> = c.ns.toString().split(':', 4);
          if (
            this.config.contracts_array.includes(keyArray[2]) &&
            (await this.settlementTaken(c.ns))
          ) {
            this.settlement.settlementHappenedProcess(keyArray[2]);
          }
        }
      }
      // check for settlement
      await this.settlement.process(block.height);
    }
  }

  private settlementTaken(ns: string): Promise<boolean> {
    let response: boolean = false;
    const url: string =
      this.config.url_api_chain + '/state/search/decision:taken:' + ns;
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
