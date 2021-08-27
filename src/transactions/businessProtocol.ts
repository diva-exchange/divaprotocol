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
import { validateContract, validateOrder } from "../net/validation";
import base64url from 'base64-url';
import {CommandContract, CommandOrder} from "./transaction";
import {AnyValidateFunction} from "ajv/dist/types";

export class BusinessProtocol {
  public readonly config: Config;
  private readonly publicKey: string = '';

  private precision = 9;

  constructor(config: Config) {
    this.config = config;
    // getPublicKey --- from api
    this.publicKey = 'teessstttttt';
  }

  // need to be refactored !!
  async processOrder(message: CommandOrder | CommandContract) {

    // here goes the stateless validation

    if (!validateOrder(message)) {
      throw Error("");
    }

    if (message.channel === 'order') {
      switch (message.command) {
        case 'add':
          await this.putAddOrder(message as CommandOrder);
          break;
        // case 'delete':
        //   await this.putDeleteOrder(message as CommandOrder);
        //   break;
      }
    }
    console.log(message);
  }

  //@FIXME "data" as param is ugly - it should accept an object - the sequence might (but must not) be also provided by the UI
  private async putAddOrder(data: CommandOrder) {
    //processing message to valid order
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [{
        seq: data.seq,
        command: 'data',
        base64url: base64url.encode(JSON.stringify(data))
      }],
      json: true
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

  // private async putDeleteOrder(message) {
  //   //processing message to valid order
  // }
}
