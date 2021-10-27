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
import base64url from 'base64-url';
import WebSocket from 'ws';
import { SubscribeManager, iSubscribe } from './subscribe-manager';
import { tNostro } from '../book/nostro';
import { Decision } from './decision';
import { Auction } from './auction';

export class BlockProcessor {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;
  private decision: Decision = {} as Decision;
  private auction: Auction = {} as Auction;

  static async make(config: Config): Promise<BlockProcessor> {
    const f = new BlockProcessor(config);
    f.orderBook = await Orderbook.make(config);
    f.subscribeManager = await SubscribeManager.make();
    f.decision = await Decision.make(config);
    f.auction = await Auction.make(config);
    return f;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public async process(block: BlockStruct): Promise<void> {
    if (
      block.height >=
      this.decision.auctionBlockHeight + this.config.waitingPeriod
    ) {
      console.log('Auction on block:' + block.height);
      this.auction.settlement(block.height);
    }
    for (const t of block.tx) {
      for (const c of t.commands) {
        //@FIXME literals -> constants or config
        if (
          c.command === 'data' &&
          c.ns.startsWith('DivaExchange:OrderBook:')
        ) {
          const decodedJsonData: tNostro = JSON.parse(
            base64url.decode(c.base64url)
          );
          await this.decision.process(decodedJsonData, block.height);

          const contract: string = decodedJsonData.contract;

          // fill marketBook
          await this.orderBook.updateMarket(contract);

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
          c.ns.startsWith('DivaExchange:Auction')
        ) {
          const contract: string = c.ns.toString().split(':', 4)[2];
          this.decision.setAuctionLockedContracts(contract);
        }
      }
    }
  }
}
