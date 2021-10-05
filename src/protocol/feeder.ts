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

import { Config } from '../config';
import { Big } from 'big.js';
import { Db } from '../util/db';
import { BlockStruct } from './struct';
import { OrderBook } from '../orderBook/orderBook';
import base64url from 'base64-url';
import WebSocket from 'ws';
import { SubscribeManager, iSubscribe } from './subscribeManager';
import { MatchBook } from '../orderBook/matchBook';
import { tBook, tRecord } from '../orderBook/book';

export class Feeder {
  private readonly config: Config;
  private readonly db: Db;
  private orderBook: OrderBook = {} as OrderBook;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;
  private matchBook: MatchBook = {} as MatchBook;

  static async make(config: Config): Promise<Feeder> {
    const f = new Feeder(config);
    f.orderBook = await OrderBook.make(config);
    f.subscribeManager = await SubscribeManager.make();
    f.matchBook = await MatchBook.make();
    return f;
  }

  private constructor(config: Config) {
    this.config = config;
    this.db = Db.make(this.config);
  }

  public async process(block: BlockStruct): Promise<void> {
    const sortedArray: number[] = this.matchBook.arrayOfMatchBlockHeights.sort(
      (n1, n2) => n1 - n2
    );
    //@FIXME hardcoded number of blocks to wait
    if (block.height === sortedArray[0] + 9) {
      console.log('exchange happen');
    }
    for (const t of block.tx) {
      for (const c of t.commands) {
        if (c.command === 'data' && c.ns.includes('DivaExchange:OrderBook')) {
          const decodedJsonData: tBook = JSON.parse(
            base64url.decode(c.base64url)
          );
          const contract: string = decodedJsonData.contract;

          // match
          if (t.origin != this.config.my_public_key) {
            this.match(decodedJsonData, t.origin, block.height);
          }

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
      }
    }
  }

  private match(
    decodedJsonData: tBook,
    origin: string,
    blockHeight: number
  ): void {
    const nostroBook: tBook = this.orderBook.getNostro(
      decodedJsonData.contract
    );
    decodedJsonData.buy.forEach((newBlockEntry) => {
      nostroBook.sell.forEach((nostroEntry) => {
        this.populateMatchBook(
          newBlockEntry,
          nostroEntry,
          origin,
          decodedJsonData.contract,
          'buy',
          blockHeight
        );
      });
    });
    decodedJsonData.sell.forEach((newBlockEntry) => {
      nostroBook.buy.forEach((nostroEntry) => {
        this.populateMatchBook(
          newBlockEntry,
          nostroEntry,
          origin,
          decodedJsonData.contract,
          'sell',
          blockHeight
        );
      });
    });
  }

  populateMatchBook(
    newBlockEntry: tRecord,
    nostroEntry: tRecord,
    origin: string,
    contract: string,
    type: 'sell' | 'buy',
    blockHeight: number
  ) {
    if (newBlockEntry.p === nostroEntry.p) {
      let nostroAmount: Big = new Big(nostroEntry.a);
      const currentAmount: number = new Big(newBlockEntry.a).toNumber();
      if (this.matchBook.getMatchMap().has(nostroEntry.id)) {
        this.matchBook.getMatchMap().forEach((matchOrigin) => {
          matchOrigin.forEach((match) => {
            match.forEach((alreadyExistingMatch) => {
              nostroAmount = nostroAmount.minus(alreadyExistingMatch.amount);
            });
          });
        });
      }
      if (nostroAmount.toNumber() > 0) {
        this.matchBook.addMatch(
          nostroEntry.id,
          origin,
          newBlockEntry.id,
          contract,
          type,
          Math.min(nostroAmount.toNumber(), currentAmount),
          newBlockEntry.p,
          blockHeight
        );
      }
    }
  }
}
