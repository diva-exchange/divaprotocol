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
  private orderBook: OrderBook = {} as OrderBook;

  public static async make(config: Config): Promise<Processor> {
    const p = new Processor(config);
    p.orderBook = await OrderBook.make(config);
    return p;
  }

  private constructor(config: Config) {
    this.config = config;
    this.db = Db.make(this.config);
  }

  async process(message: Message): Promise<void> {
    switch (message.command) {
      case 'delete':
      case 'add':
        this.orderBook.update(
          message.id,
          message.contract,
          message.type,
          message.price,
          message.command === 'delete' ? -1 * message.amount : message.amount
        );
        this.storeOrderBookOnChain(message);
        break;
      case 'contract':
        break;
      case 'subscribe':
        break;
      case 'unsubscribe':
        break;
      default:
        throw Error('Processor.process(): Invalid Command');
    }
  }

  private storeOrderBookOnChain(message: Message) {
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
            JSON.stringify(this.orderBook.getNostro(message.contract))
          ),
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
}
