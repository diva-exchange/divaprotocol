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
import base64url from 'base64-url';

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
  async processOrder(message: Object) {
    if (message === null || typeof message !== 'object') {
      return;
    }

    // if (message.channel === 'order') {
    //   switch (message.command) {
    //     case 'add':
    //       await this.putAddOrder(message);
    //       break;
    //     case 'delete':
    //       await this.putDeleteOrder(message);
    //       break;
    //   }
    //}
    //console.log(message);
  }

  // private async putAddAsset(message: Buffer) {
  //   //processing message to valid asset
  // }
  //
  // private async putDeleteAsset(message: Buffer) {
  //   //processing message to valid asset
  // }

  //@FIXME "data" as param is ugly - it should accept an object - the sequence might (but must not) be also provided by the UI
  private async putAddOrder(data: object) {
    //processing message to valid order
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [{
        seq: 1, //@FIXME
        command: 'data',
        base64url: data
      }],
      json: true
    };
    console.log(opts);
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

  private async putDeleteOrder(message: Buffer) {
    //processing message to valid order
  }
}
