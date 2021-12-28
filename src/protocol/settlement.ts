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
import { Match, tMatch } from '../book/match';
import { Decision } from './decision';
import get from 'simple-get';
import { Logger } from '../util/logger';
import { Orderbook } from '../book/orderbook';
import { MessageProcessor } from './message-processor';
import { OrdersMatch } from './orders-match';

export class Settlement {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  private match: Match = {} as Match;
  private decision: Decision = {} as Decision;
  private messageProcessor: MessageProcessor = {} as MessageProcessor;
  private ordersMatch: OrdersMatch = {} as OrdersMatch;

  static async make(config: Config): Promise<Settlement> {
    const a = new Settlement(config);
    a.orderBook = await Orderbook.make(config);
    a.match = await Match.make();
    a.decision = await Decision.make(config);
    a.messageProcessor = await MessageProcessor.make(config);
    a.ordersMatch = await OrdersMatch.make(config);
    return a;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public async process(blockHeight: number) {
    const mapOfRBH: Map<string, number> =
      await this.decision.getAuctionRestrictBlockHeight();
    mapOfRBH.forEach((value, contract) => {
      if (blockHeight == value) {
        console.log('Settlement on block: ' + blockHeight);
        this.ordersMatch.populateMatchBook(contract).then(() => {
          this.sendSettlementToChain(contract, blockHeight);
          if (this.deleteMyMatchesFromNostro(contract)) {
            this.messageProcessor.sendSubscriptions(contract, 'nostro');
            this.messageProcessor.storeNostroOnChain(contract);
          }
          this.match.getMatchMap().set(contract, new Array<tMatch>());
        });
      }
    });
  }

  private sendSettlementToChain(contract: string, blockheight: number): void {
    const data = this.match.getMatchMap().get(contract) || '';
    const nameSpace: string =
      'DivaExchange:Settlement:' + contract + ':' + blockheight;
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [
        {
          seq: 1,
          command: 'decision',
          ns: nameSpace,
          d: JSON.stringify(data),
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

  private deleteMyMatchesFromNostro(contract: string): boolean {
    let orderFound = false;
    const data: Array<tMatch> | undefined =
      this.match.getMatchMap().get(contract) || new Array<tMatch>();
    if (data.length > 0) {
      data.forEach((v) => {
        if (v.buy.pk === this.config.my_public_key) {
          this.deleteOrder(contract, 'buy', v.buy.id, v.buy.p, v.buy.a);
          orderFound = true;
        }
        if (v.sell.pk === this.config.my_public_key) {
          this.deleteOrder(contract, 'sell', v.sell.id, v.sell.p, v.sell.a);
          orderFound = true;
        }
      });
    }
    return orderFound;
  }

  private deleteOrder(
    contract: string,
    type: 'buy' | 'sell',
    id: number,
    p: string,
    a: string
  ) {
    this.orderBook.deleteNostro(id, contract, type, p, a);
  }
}
