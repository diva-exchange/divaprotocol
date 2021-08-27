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
import LevelUp from 'levelup';
import LevelDown from 'leveldown';
import path from 'path';
import Big from 'big.js';
import { Logger } from '../logger';
import { BlockStruct } from './block';
import {
  CommandAddAsset,
  CommandAddOrder,
  CommandDeleteAsset,
  CommandDeleteOrder,
} from './transaction';
import get from 'simple-get';
import base64url from 'base64-url';

export class BusinessProtocol {
  public readonly config: Config;
  private readonly publicKey: string = '';
  private readonly dbState: InstanceType<typeof LevelUp>;

  //private mapPeer: Map<string, NetworkPeer> = new Map();
  private precision = 9;

  constructor(config: Config) {
    this.config = config;
    // getPublicKey --- from api
    this.publicKey = 'teessstttttt';

    this.dbState = LevelUp(
      LevelDown(path.join(this.config.path_state, this.publicKey)),
      {
        createIfMissing: true,
        errorIfExists: false,
        compression: true,
        cacheSize: 2 * 1024 * 1024, // 2 MB
      }
    );
  }

  async shutdown() {
    await this.dbState.close();
  }

  async clear() {
    await this.dbState.clear();
  }

  // need to be refactored !!
  async processOrder(message: Buffer) {
    let obj: any = {}; //@FIXME proper definition
    try {
      obj = JSON.parse(message.toString());
    } catch (error: any) {
      Logger.trace(error);
      return;
    }

    console.log(obj);
    switch (obj.command) {
      // case 'addAsset':
      //   await this.putAddAsset(obj);
      //   break;
      // case 'deleteAsset':
      //   await this.putDeleteAsset(obj);
      //   break;
      case 'addOrder':
        await this.putAddOrder(obj.data);
        break;
      // case 'deleteOrder':
      //   await this.putDeleteOrder(obj);
      //   break;
    }
  }

  async processState(block: BlockStruct) {
    for (const t of block.tx) {
      for (const c of t.commands) {
        console.log(c.command);
        switch (c.command) {
          case 'addAsset':
            await this.addAsset(c as CommandAddAsset);
            break;
          case 'deleteAsset':
            await this.deleteAsset(c as CommandDeleteAsset);
            break;
          case 'addOrder':
            await this.addOrder(c as CommandAddOrder);
            break;
          case 'deleteOrder':
            await this.deleteOrder(c as CommandDeleteOrder);
            break;
        }
      }
    }
  }

  private async addAsset(command: CommandAddAsset) {
    await this.dbState.put(
      'asset:' + command.identAssetPair,
      command.identAssetPair
    );
  }

  private async deleteAsset(command: CommandDeleteAsset) {
    return new Promise((resolve, reject) => {
      this.dbState
          .createReadStream()
          .on('data', (data) => {
            if (data.key.toString().includes(command.identAssetPair)) {
              this.dbState.del(data.key.toString());
            }
          })
          .on('end', () => {
            resolve(this.dbState);
          })
          .on('error', (e) => {
            reject(e);
          });
    });
  }

  private async addOrder(command: CommandAddOrder) {
    let currentMap = new Map<string, string>();
    command = BusinessProtocol.deleteDotFromTheEnd(command);
    const key =
        'order:' +
        command.identAssetPair +
        ':' +
        command.orderType ;
    try {
      currentMap = await this.dbState.get(key);
    } catch (err) {
      Logger.error(err);
    }
    let amountString = currentMap.get(command.price.toString());
    let amount = new Big(amountString || 0).toNumber();
    currentMap.set(command.price.toString(),new Big(command.amount || 0).plus(amount).toFixed(this.precision));
    await this.dbState.put(key,currentMap);
  }

  private async deleteOrder(command: CommandDeleteOrder) {
    let currentMap = new Map<string, string>();
    command = BusinessProtocol.deleteDotFromTheEnd(command);
    const key =
        'order:' +
        command.identAssetPair +
        ':' +
        command.orderType;
    try {
      currentMap = await this.dbState.get(key);
    } catch (err) {
      Logger.error(err);
    }
    let amountString = currentMap.get(command.price.toString());
    let amount = new Big(amountString || 0).toNumber();
    if (amount > 0) {
      if (parseFloat(command.amount) >= amount) {
        currentMap.delete(key);
      } else {
        currentMap.set(key, new Big(amount || 0)
            .minus(new Big(command.amount || 0))
            .toFixed(this.precision))
      }
    }
    await this.dbState.put(
        key,
        currentMap
    );
  }

  private static deleteDotFromTheEnd(
    command: CommandAddOrder | CommandDeleteOrder
  ) {
    if (command.price[command.price.length - 1] === '.') {
      command.price = command.price.slice(0, -1);
    }
    if (command.amount[command.amount.length - 1] === '.') {
      command.amount = command.amount.slice(0, -1);
    }
    return command;
  }

  // private async putAddAsset(message: Buffer) {
  //   //processing message to valid asset
  // }
  //
  // private async putDeleteAsset(message: Buffer) {
  //   //processing message to valid asset
  // }

  //@FIXME "data" as param is ugly - it should accept an object - the sequence might (but must not) be also provided by the UI
  private async putAddOrder(data: string) {
    //processing message to valid order
    const opts = {
      method: 'PUT',
      url: this.config.url_api_chain + '/transaction',
      body: [{
        seq: 1, //@FIXME
        command: 'data',
        base64url: base64url.encode(data)
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

  // private async putDeleteOrder(message: Buffer) {
  //   //processing message to valid order
  // }
}
