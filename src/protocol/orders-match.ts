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
import { Match, mRecord } from '../book/match';
import { Big } from 'big.js';
import get from 'simple-get';
import { tNostro } from '../book/nostro';
import base64url from 'base64-url';
import { Validation } from '../net/validation';
import { Logger } from '../util/logger';
import { Config } from '../config/config';
import { Orderbook } from '../book/orderbook';
import { Decision } from './decision';
import { MessageProcessor } from './message-processor';
import { tRecord } from '../book/market';

export class OrdersMatch {
  private readonly config: Config;
  private orderBook: Orderbook = {} as Orderbook;
  private match: Match = {} as Match;
  private decision: Decision = {} as Decision;
  private messageProcessor: MessageProcessor = {} as MessageProcessor;
  private stakes: Map<string, number> = new Map<string, number>();

  static async make(config: Config): Promise<OrdersMatch> {
    const om = new OrdersMatch(config);
    om.orderBook = await Orderbook.make(config);
    om.match = await Match.make();
    om.decision = await Decision.make(config);
    om.messageProcessor = await MessageProcessor.make(config);
    return om;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  async populateMatchBook(contract: string) {
    const matchOrders: Map<string, Array<mRecord>> = await this.getMatchOrders(
      contract
    );
    const buyMRecordArray = this.sortMRecords(
      matchOrders.get('buy') || Array()
    );
    const sellMRecordArray = this.sortMRecords(
      matchOrders.get('sell') || Array(),
      -1
    );

    while (buyMRecordArray.length != 0 && sellMRecordArray.length != 0) {
      const buyValue: mRecord = buyMRecordArray[0];
      const sellValue: mRecord = sellMRecordArray[0];
      const ba = new Big(buyValue.a).toNumber();
      const sa = new Big(sellValue.a).toNumber();
      const bp = new Big(buyValue.p).toNumber();
      const sp = new Big(sellValue.p).toNumber();

      if (bp >= sp) {
        this.match.addMatch(
          contract,
          buyValue.pk,
          buyValue.id,
          buyValue.p,
          sellValue.pk,
          sellValue.id,
          sellValue.p,
          Math.min(ba, sa).toString()
        );
        const remaining: Number = Math.abs(ba - sa);
        if (ba - sa <= 0) {
          buyMRecordArray.shift();
          if (remaining != 0) {
            sellMRecordArray[0].a = remaining.toString();
          }
        }
        if (ba - sa >= 0) {
          sellMRecordArray.shift();
          if (remaining != 0) {
            buyMRecordArray[0].a = remaining.toString();
          }
        }
      }
    }
  }

  private async getMatchOrders(
    contract: string
  ): Promise<Map<string, Array<mRecord>>> {
    const buyInDescOrder: Array<tRecord> = this.decision.marketBuyInDescOrder(
      this.orderBook.getMarket(contract)
    );
    const sellInAscOrder: Array<tRecord> = this.decision.marketSellInAscOrder(
      this.orderBook.getMarket(contract)
    );
    if (buyInDescOrder.length < 1 || sellInAscOrder.length < 1) {
      return new Map<string, Array<mRecord>>();
    }
    const sellCrossPrice: Number = this.getSellCrossLimit(
      buyInDescOrder,
      sellInAscOrder
    );
    const buyCrossPrice: Number = this.getBuyCrossLimit(
      buyInDescOrder,
      sellInAscOrder
    );
    const buyMRecordArray = new Array<mRecord>();
    const sellMRecordArray = new Array<mRecord>();

    const data = await this.getState();
    if (data) {
      const allData = [...JSON.parse(data)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 4);
        if (
          keyArray[0] === 'DivaExchange' &&
          keyArray[1] === 'OrderBook' &&
          keyArray[2] === contract
        ) {
          try {
            const book: tNostro = JSON.parse(base64url.decode(element.value));
            if (Validation.make().validateBook(book)) {
              book.buy.forEach((value) => {
                if (new Big(value.p).toNumber() >= buyCrossPrice) {
                  buyMRecordArray.push({
                    pk: keyArray[3],
                    id: value.id,
                    p: value.p,
                    a: value.a,
                  });
                }
              });
              book.sell.forEach((value) => {
                if (new Big(value.p).toNumber() <= sellCrossPrice) {
                  sellMRecordArray.push({
                    pk: keyArray[3],
                    id: value.id,
                    p: value.p,
                    a: value.a,
                  });
                }
              });
            }
          } catch (error: any) {
            Logger.error(error);
          }
        }
        if (element.key.startsWith('peer') && keyArray.length == 2) {
          this.stakes.set(keyArray[1], new Big(element.value).toNumber());
        }
      });
    }
    return new Map<string, Array<mRecord>>()
      .set('buy', buyMRecordArray)
      .set('sell', sellMRecordArray);
  }

  getSellCrossLimit(
    buyInDescOrder: Array<tRecord>,
    sellInAscOrder: Array<tRecord>
  ): Number {
    let sellCrossHigh: Number = 0;
    sellInAscOrder.forEach((value) => {
      if (Big(value.p).toNumber() <= Big(buyInDescOrder[0].p).toNumber()) {
        sellCrossHigh = Big(value.p).toNumber();
      }
    });
    return sellCrossHigh;
  }

  getBuyCrossLimit(
    buyInDescOrder: Array<tRecord>,
    sellInAscOrder: Array<tRecord>
  ): Number {
    let buyCrossLow: Number = 0;
    buyInDescOrder.forEach((value) => {
      if (Big(value.p).toNumber() >= Big(sellInAscOrder[0].p).toNumber()) {
        buyCrossLow = Big(value.p).toNumber();
      }
    });
    return buyCrossLow;
  }

  public sortMRecords(
    mRecordsArray: Array<mRecord>,
    order: number = 1
  ): Array<mRecord> {
    if (mRecordsArray.length > 0) {
      mRecordsArray.sort((a, b) => {
        if (a.p.padStart(21, '0') == b.p.padStart(21, '0')) {
          return this.stakeRanking(a.pk, b.pk);
        } else {
          return a.p.padStart(21, '0') > b.p.padStart(21, '0')
            ? order * -1
            : order * 1;
        }
      });
      return mRecordsArray;
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

  private stakeRanking(pk: string, pk2: string) {
    let stake1 = 0;
    let stake2 = 0;
    if (this.stakes.has(pk)) {
      stake1 = this.stakes.get(pk) || 0;
    }
    if (this.stakes.has(pk2)) {
      stake2 = this.stakes.get(pk2) || 0;
    }
    if (stake1 !== stake2) {
      return stake1 > stake2 ? 1 : -1;
    }
    return pk > pk2 ? 1 : -1;
  }
}
