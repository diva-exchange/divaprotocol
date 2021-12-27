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

export class BlockProcessor {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;
  private decision: Decision = {} as Decision;
  private settlement: Settlement = {} as Settlement;

  static async make(config: Config): Promise<BlockProcessor> {
    const f = new BlockProcessor(config);
    f.orderBook = await Orderbook.make(config);
    f.subscribeManager = await SubscribeManager.make();
    f.decision = await Decision.make(config);
    f.settlement = await Settlement.make(config);
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

          // check for settlement
          await this.settlement.process(contract, block.height);

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
      }
    }
  }
}
