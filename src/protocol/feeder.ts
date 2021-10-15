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
import { Orderbook } from '../book/orderbook';
import base64url from 'base64-url';
import WebSocket from 'ws';
import { SubscribeManager, iSubscribe } from './subscribe-manager';
import { Match } from '../book/match';
import { tNostro, tRecord } from '../book/nostro';
import { Validation } from '../net/validation';
import get from 'simple-get';
import { Logger } from '../util/logger';

export class Feeder {
  private readonly config: Config;
  private readonly db: Db;
  private nostro: Orderbook = {} as Orderbook;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;
  private match: Match = {} as Match;

  static async make(config: Config): Promise<Feeder> {
    const f = new Feeder(config);
    f.nostro = await Orderbook.make(config);
    f.subscribeManager = await SubscribeManager.make();
    f.match = await Match.make();
    return f;
  }

  private constructor(config: Config) {
    this.config = config;
    this.db = Db.make(this.config);
  }

  public async process(block: BlockStruct): Promise<void> {
    for (const t of block.tx) {
      for (const c of t.commands) {
        if (c.command === 'decision') {
          const decodedJsonData: tNostro = JSON.parse(
            base64url.decode(c.base64url)
          );
          //this.match(decodedJsonData, t.origin, block.height);
          await this.checkStateForMatch(decodedJsonData, block.height);
          // this.publishMatchBlock();
        }
        //@FIXME literals -> constants or config
        if (
          c.command === 'data' &&
          c.ns.startsWith('DivaExchange:OrderBook:')
        ) {
          const decodedJsonData: tNostro = JSON.parse(
            base64url.decode(c.base64url)
          );
          const contract: string = decodedJsonData.contract;

          //@FIXME why are messages with a local origin excluded? It might be a match with others or a match with itself...
          // match
          if (t.origin != this.config.my_public_key) {
            this.doMatch(decodedJsonData, t.origin, block.height);
          }

          // fill marketBook
          await this.nostro.updateMarket(contract);

          // subscription
          const sub: Map<WebSocket, iSubscribe> =
            this.subscribeManager.getSubscriptions();

          sub.forEach((subscribe, ws) => {
            if (subscribe.market.has(contract)) {
              const marketBook = this.nostro.getMarket(contract);
              ws.send(JSON.stringify(marketBook));
            }
          });
        }
      }
    }
  }

  //@FIXME very expensive (nested loops) - only the top records are interesting to detect matches
  //@FIXME Ex: on simple books with only 10'000 market entries and 100 nostro entries, it will already loop 2'000'000x
  private doMatch(
    decodedJsonData: tNostro,
    origin: string,
    blockHeight: number
  ): void {
    const nostroBook: tNostro = this.nostro.getNostro(decodedJsonData.contract);
    decodedJsonData.buy.forEach((newBlockEntry) => {
      nostroBook.sell.forEach((nostroEntry) => {
        this.populateMatch(
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
        this.populateMatch(
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

  populateMatch(
    newBlockEntry: tRecord,
    nostroEntry: tRecord,
    origin: string,
    contract: string,
    type: 'sell' | 'buy',
    blockHeight: number
  ) {
    //@FIXME === (equality) is not enough - it must detect crosses: BidPrice >= AskPrice (or BuyPrice >= SellPrice)
    if (
      (type === 'buy' && newBlockEntry.p >= nostroEntry.p) ||
      (type === 'sell' && newBlockEntry.p <= nostroEntry.p)
    ) {
      let nostroAmount: Big = new Big(nostroEntry.a);
      const currentAmount: number = new Big(newBlockEntry.a).toNumber();
      if (this.match.getMatchMap().has(nostroEntry.id)) {
        this.match.getMatchMap().forEach((matchOrigin) => {
          matchOrigin.forEach((match) => {
            match.forEach((alreadyExistingMatch) => {
              nostroAmount = nostroAmount.minus(alreadyExistingMatch.amount);
            });
          });
        });
      }
      if (nostroAmount.toNumber() > 0) {
        this.match.addMatch(
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

  private async checkStateForMatch(
    decodedJsonData: tNostro,
    blockHeight: number
  ) {
    const states: string = await this.getState();
    if (states) {
      const allData = [...JSON.parse(states)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 4);
        if (
          keyArray[1] === 'DivaExchange' &&
          keyArray[2] === 'OrderBook' &&
          keyArray[3] === decodedJsonData.contract
        ) {
          try {
            const book: tNostro = JSON.parse(base64url.decode(element.value));
            if (Validation.make().validateBook(book)) {
              this.doMatch(book, keyArray[0], blockHeight);
            }
          } catch (error: any) {
            Logger.error(error);
          }
        }
      });
    }
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
