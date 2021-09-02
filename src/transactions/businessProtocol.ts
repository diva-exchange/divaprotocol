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
import {
  validateContract,
  validateOrder,
  validateSubscribe,
} from '../net/validation';
import base64url from 'base64-url';
import { CommandContract, CommandOrder, CommandSubscribe } from './transaction';
import { OrderBook } from './orderBook';

export class BusinessProtocol {
  public readonly config: Config;
  private readonly db: Db;
  private orderBook: OrderBook;

  constructor(config: Config) {
    this.config = config;
    this.db = Db.make(this.config);
    this.orderBook = new OrderBook(this.config);
  }

  async processOrder(
    message: CommandOrder | CommandContract | CommandSubscribe
  ) {
    if (
      !validateOrder(message) &&
      !validateContract(message) &&
      !validateSubscribe(message)
    ) {
      throw Error('BusinessProtocol.processOrder(): Invalid Message');
    }

    switch (message.command) {
      case 'add':
      case 'delete':
        // 1. create the new order book
        // 2. send the new order book to the blockchain (transaction)
        // 3. if blockchain result is
        //    3a. OK: store the orderbook in the state, send the new order book to subscribers and return
        //    3b. ERROR: throw error and crash -> later: retry? or...?
        return await this.putOrder(message as CommandOrder);
      case 'contract':
        return await this.putContract(message as CommandContract);
      case 'subscribe':
        return await this.orderBook.getSubscribe((message as CommandSubscribe).channel, (message as CommandSubscribe).contract);
      default:
        throw Error('BusinessProtocol.processOrder(): Invalid Command');
    }
  }

  private async putOrder(data: CommandOrder) {
    const opts = this.createOrder(data);
    return new Promise((resolve, reject) => {
      get.concat(opts, (error: Error, res: any) => {
        if (error) {
          Logger.trace(error);
          reject(error);
          return;
        }
        if (res.statusCode == 200) {
          this.storeNostroData(data);
        }
        resolve(res);
      });
    });
  }

  private createOrder(data: CommandOrder) {
    let nameSpace: string = this.getNamespace(data.command);
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [
        {
          seq: data.seq,
          command: 'data',
          ns: nameSpace,
          base64url: base64url.encode(JSON.stringify(data)),
        },
      ],
      json: true,
    };
    return opts;
  }

  private getNamespace(command: string): string {
    let nameSpace: string = '';
    switch (command) {
      case 'add':
        nameSpace = 'DivaExchangeOrderAdd';
        break;
      case 'delete':
        nameSpace = 'DivaExchangeOrderDelete';
        break;
      default:
        return '';
    }
    return nameSpace;
  }

  private async putContract(message: CommandContract) {
    console.log(message);
  }

  private async storeNostroData(data: CommandOrder) {
    const key = this.getNostroOrderKey(data);
    const newEntry: string = data.amount.toString() + '@' + data.price.toString();
    const currentArray: Array<string> = await this.db.getValueByKey(key);
    currentArray.unshift(newEntry);
    await this.db.updateByKey(key, [...currentArray]);
  }

  private getNostroOrderKey(data: CommandOrder): string {
    const key = 'order_nostro:' + data.contract + ':' + data.type;
    return key;
  }
}
