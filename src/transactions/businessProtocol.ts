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
import {
  validateContract,
  validateOrder,
  validateSubscribe,
} from '../net/validation';
import base64url from 'base64-url';
import { CommandContract, CommandOrder, CommandSubscribe } from './transaction';

export class BusinessProtocol {
  public readonly config: Config;

  constructor(config: Config) {
    this.config = config;
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
      default:
        throw Error('BusinessProtocol.processOrder(): Invalid Command');
    }
  }

  private async putOrder(data: CommandOrder) {
    const nameSpace =
      data.command == 'add'
        ? 'DivaExchangeOrderAdd'
        : 'DivaExchangeOrderDelete';

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

    return new Promise((resolve, reject) => {
      get.concat(opts, (error: Error, response: any) => {
        if (error) {
          Logger.trace(error);
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  private async putContract(message: CommandContract) {
    console.log(message);
  }
}
