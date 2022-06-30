/**
 * Copyright (C) 2021-2022 diva.exchange
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
import get from 'simple-get';
import { Orderbook } from '../book/orderbook';
import { Message } from './struct';
import WebSocket from 'ws';
import { SubscriptionManager } from './subscription-manager';

const MESSAGE_DELETE_ALL = 'delete-all';
const MESSAGE_DELETE = 'delete';
const MESSAGE_ADD = 'add';
const MESSAGE_CONTRACT = 'contract';
const MESSAGE_SUBSCRIBE = 'subscribe';
const MESSAGE_UNSUBSCRIBE = 'unsubscribe';

export class MessageProcessor {
  public readonly config: Config;
  private orderbook: Orderbook = {} as Orderbook;
  private subscriptionManager: SubscriptionManager = {} as SubscriptionManager;

  public static async make(config: Config): Promise<MessageProcessor> {
    const p = new MessageProcessor(config);
    p.orderbook = await Orderbook.make(config);
    p.subscriptionManager = await SubscriptionManager.make();
    return p;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public async process(message: Message, ws: WebSocket): Promise<void> {
    switch (message.command) {
      case MESSAGE_DELETE_ALL:
        this.orderbook.deleteAll(message.contract);
        await this.storeNostroOnChain(message.contract);
        this.subscriptionManager.broadcast(message.contract, 'nostro', this.orderbook.getNostro(message.contract));
        break;
      case MESSAGE_DELETE:
        this.orderbook.delete(message.id, message.contract, message.type);
        await this.storeNostroOnChain(message.contract);
        this.subscriptionManager.broadcast(message.contract, 'nostro', this.orderbook.getNostro(message.contract));
        break;
      case MESSAGE_ADD:
        this.orderbook.add(message.id, message.contract, message.type, message.price, message.amount);
        await this.storeNostroOnChain(message.contract);
        this.subscriptionManager.broadcast(message.contract, 'nostro', this.orderbook.getNostro(message.contract));
        break;
      case MESSAGE_CONTRACT:
        break;
      case MESSAGE_SUBSCRIBE:
        this.subscriptionManager.subscribe(ws, message);
        message.channel === 'nostro'
          ? this.subscriptionManager.broadcast(message.contract, 'nostro', this.orderbook.getNostro(message.contract))
          : this.subscriptionManager.broadcast(message.contract, 'market', this.orderbook.getMarket(message.contract));
        break;
      case MESSAGE_UNSUBSCRIBE:
        this.subscriptionManager.unsubscribe(ws, message);
        break;
      default:
        throw Error('MessageProcessor.process(): Invalid Command');
    }
  }

  storeNostroOnChain(contract: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const nameSpace: string = this.config.ns_first_part + this.config.ns_order_book + contract;
      const opts = {
        method: 'PUT',
        url: this.config.url_api_chain + '/transaction',
        body: [
          {
            seq: 1,
            command: 'data',
            ns: nameSpace,
            d: JSON.stringify(this.orderbook.getNostro(contract)),
          },
        ],
        json: true,
        followRedirects: false,
      };
      get.concat(opts, (error: Error) => {
        error ? reject() : resolve();
      });
    });
  }
}
