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
import { Logger } from '../util/logger';
import get from 'simple-get';
import { Orderbook } from '../book/orderbook';
import { Message } from './struct';
import WebSocket from 'ws';
import { SubscribeManager, iSubscribe } from './subscribe-manager';

export class MessageProcessor {
  public readonly config: Config;
  private orderbook: Orderbook = {} as Orderbook;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;

  public static async make(config: Config): Promise<MessageProcessor> {
    const p = new MessageProcessor(config);
    p.orderbook = await Orderbook.make(config);
    p.subscribeManager = await SubscribeManager.make();
    return p;
  }

  private constructor(config: Config) {
    this.config = config;
  }

  public async process(message: Message, ws: WebSocket): Promise<void> {
    switch (message.command) {
      case 'delete':
        this.orderbook.deleteNostro(
          message.id,
          message.contract,
          message.type,
          message.price,
          message.amount
        );
        this.sendSubscriptions(message.contract, 'nostro');
        this.storeNostroOnChain(message.contract);
        break;
      case 'add':
        this.orderbook.addNostro(
          message.id,
          message.contract,
          message.type,
          message.price,
          message.amount
        );
        this.sendSubscriptions(message.contract, 'nostro');
        this.storeNostroOnChain(message.contract);
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
        throw Error('MessageProcessor.process(): Invalid Command');
    }
  }

  sendSubscriptions(contract: string, channel: string): void {
    const sub: Map<WebSocket, iSubscribe> =
      this.subscribeManager.getSubscriptions();

    sub.forEach((subscribe, ws) => {
      if (subscribe.market.has(contract) && channel === 'market') {
        const marketBook = this.orderbook.getMarket(contract);
        ws.send(JSON.stringify(marketBook));
      }
      if (subscribe.nostro.has(contract) && channel === 'nostro') {
        const nostroBook = this.orderbook.getNostro(contract);
        ws.send(JSON.stringify(nostroBook));
      }
    });
  }

  storeNostroOnChain(contract: string): void {
    const nameSpace: string = 'DivaExchange:OrderBook:' + contract;
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
    };
    get.concat(opts, (error: Error) => {
      if (error) {
        //@FIXME logging and error handling
        Logger.trace(error);
      }
    });
  }
}
