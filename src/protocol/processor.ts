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
import WebSocket from 'ws';
import { SubscribeManager, iSubscribe } from './subscribeManager';

export class Processor {
  public readonly config: Config;
  private readonly db: Db;
  private orderBook: OrderBook = {} as OrderBook;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;

  public static async make(config: Config): Promise<Processor> {
    const p = new Processor(config);
    p.orderBook = await OrderBook.make(config);
    p.subscribeManager = await SubscribeManager.make();
    return p;
  }

  private constructor(config: Config) {
    this.config = config;
    this.db = Db.make(this.config);
  }

  async process(message: Message, ws: WebSocket): Promise<void> {
    switch (message.command) {
      case 'delete':
        this.orderBook.deleteNostro(
          message.id,
          message.contract,
          message.type,
          message.price,
          message.amount
        );
        this.sendSubscriptions(message.contract, 'nostro');
        this.storeOrderBookOnChain(message);
        break;
      case 'add':
        this.orderBook.addNostro(
          message.id,
          message.contract,
          message.type,
          message.price,
          message.amount
        );
        this.sendSubscriptions(message.contract, 'nostro');
        this.storeOrderBookOnChain(message);
        break;
      case 'contract':
        break;
      case 'subscribe':
        this.subscribeManager.setSockets(ws, message);
        this.sendSubscriptions(message.contract, message.channel);
        break;
      case 'unsubscribe':
        this.subscribeManager.setSockets(ws, message);
        break;
      default:
        throw Error('Processor.process(): Invalid Command');
    }
  }

  private sendSubscriptions(contract: string, channel: string) {
    const sub: Map<WebSocket, iSubscribe> =
      this.subscribeManager.getSubscriptions();

    sub.forEach((subscribe, ws) => {
      if (subscribe.market.has(contract) && channel === 'market') {
        const marketBook = this.orderBook.getMarket(contract);
        ws.send(JSON.stringify(marketBook));
      }
      if (subscribe.nostro.has(contract) && channel === 'nostro') {
        const nostroBook = this.orderBook.getNostro(contract);
        ws.send(JSON.stringify(nostroBook));
      }
    });
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
