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
import { Logger } from '../logger';
import get from 'simple-get';
import { Db } from '../db';
import base64url from 'base64-url';
import { OrderBook } from './orderBook';
import { Message } from './struct';

export class Processor {
  public readonly config: Config;
  private readonly db: Db;
  private readonly orderBook: OrderBook;

  constructor(config: Config) {
    this.config = config;
    this.db = Db.make(this.config);
    this.orderBook = OrderBook.make(this.db);
  }

  async process(message: Message) {
    switch (message.command) {
      case 'add':
      case 'delete':
        // 1. create the new order book
        // 2. send the new order book to the blockchain (transaction)
        // 3. if blockchain result is
        //    3a. OK: store the orderbook in the state, send the new order book to subscribers and return
        //    3b. ERROR: throw error and crash -> later: retry? or...?
        this.orderBook.updateBook(
          message.contract,
          message.type,
          message.price,
          message.amount
        );
        return await this.storeOrderBookOnChain(message);
      case 'contract':
        //@FIXME
        return;
      //return await this.putContract(message);
      case 'subscribe':
        //@FIXME
        return;
      // return await this.orderBook.getSubscribe(message.channel, message.contract);
      default:
        throw Error('BusinessProtocol.processOrder(): Invalid Command');
    }
  }

  private async storeOrderBookOnChain(message: Message) {
    const nameSpace: string = 'DivaExchange:OrderBook:' + message.contract;
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [
        {
          seq: message.seq,
          command: 'data',
          ns: nameSpace,
          base64url: base64url.encode(
            JSON.stringify(this.orderBook.get(message.contract))
          ),
        },
      ],
      json: true,
    };
    return new Promise((resolve, reject) => {
      get.concat(opts, (error: Error, res: any) => {
        if (error) {
          Logger.trace(error);
          reject(error);
          return;
        }
        resolve(res);
      });
    });
  }
}
