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
import { Big } from 'big.js';

type iRecord = {
  pk_from: string;
  c: string;
  a: string;
  pk_to: string;
};

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
        });
      }
    });
  }

  settlementHappenedProcess(contract: string) {
    if (this.deleteMyMatchesFromNostro(contract)) {
      this.messageProcessor.sendSubscriptions(contract, 'nostro');
      this.messageProcessor.storeNostroOnChain(contract);
    }
    this.match.getMatchMap().set(contract, new Array<tMatch>());
  }

  private sendSettlementToChain(contract: string, blockheight: number): void {
    const matchData: Array<tMatch> =
      this.match.getMatchMap().get(contract) || Array<tMatch>();
    const instructions = this.getInstructions(matchData, contract);
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
          d: JSON.stringify({
            matchBook: matchData,
            instructions: instructions,
          }),
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

  deleteMyMatchesFromNostro(contract: string): boolean {
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

  private getInstructions(
    data: Array<tMatch>,
    contract: string
  ): Array<iRecord> {
    const result: Array<iRecord> = Array<iRecord>();
    const currencies: Array<string> = contract.split('_', 2);
    const currency1: string = currencies[0];
    const currency2: string = currencies[1];
    if (data.length > 0) {
      for (const match of data) {
        const countedAmount: string = Big(match.buy.p)
          .times(match.buy.a)
          .toPrecision(this.config.decimalPrecision);
        result.push(
          this.getInstructionRecord(
            match.buy.pk,
            match.sell.pk,
            currency2,
            countedAmount
          )
        );
        result.push(
          this.getInstructionRecord(
            match.sell.pk,
            match.buy.pk,
            currency1,
            new Big(match.sell.a)
              .toPrecision(this.config.decimalPrecision)
              .toString()
          )
        );
      }
    }
    return result;
  }

  private getInstructionRecord(
    pkFrom: string,
    pkTo: string,
    currency: string,
    amount: string
  ): iRecord {
    return {
      pk_from: pkFrom,
      c: currency,
      a: amount,
      pk_to: pkTo,
    };
  }
}
