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

import { BlockStruct } from './block';
import { Util } from './util';
import fs from 'fs';
import LevelUp from 'levelup';
import LevelDown from 'leveldown';
import path from 'path';
import Big from 'big.js';
import {
  CommandAddAsset,
  CommandDeleteAsset,
  CommandAddOrder,
  CommandDeleteOrder,
} from './transaction';
import { Server } from '../net/server';
import { Logger } from '../logger';

export class Blockchain {
  private readonly server: Server;
  private readonly publicKey: string = '';
  private readonly dbState: InstanceType<typeof LevelUp>;

  private height: number = 0;
  private mapBlocks: Map<number, BlockStruct> = new Map();
  private latestBlock: BlockStruct = {} as BlockStruct;

  //private mapPeer: Map<string, NetworkPeer> = new Map();
  private precision = 9;

  static async make(server: Server): Promise<Blockchain> {
    const b = new Blockchain(server);
    return b;
  }

  private constructor(server: Server) {
    this.server = server;
    // getPublicKey --- from api
    //this.publicKey = this.server.getWallet().getPublicKey();

    this.dbState = LevelUp(LevelDown(path.join(this.server.config.path_state, this.publicKey)), {
      createIfMissing: true,
      errorIfExists: false,
      compression: true,
      cacheSize: 2 * 1024 * 1024, // 2 MB
    });
  }

  async shutdown() {
    await this.dbState.close();
  }

  async clear() {
    await this.dbState.clear();

    this.height = 0;
    this.mapBlocks = new Map();
    this.latestBlock = {} as BlockStruct;
    //this.mapPeer = new Map();
  }

  async add(block: BlockStruct): Promise<void> {
    if (
      this.height + 1 !== block.height ||
      block.previousHash !== this.latestBlock.hash ||
      block.hash !== Blockchain.hashBlock(block)
    ) {
      Logger.warn(
        `Failed to verify block "${block.height}", ` +
          `Height check: ${this.height + 1 !== block.height ? 'failed' : 'ok'}, ` +
          `Previous Hash check: ${block.previousHash !== this.latestBlock.hash ? 'failed' : 'ok'}, ` +
          `Hash check: ${block.hash !== Blockchain.hashBlock(block) ? 'failed' : 'ok'}`
      );
      return;
    }
  }

  async getState(key: string = ''): Promise<Array<{key: string, value: string}>> {
    return new Promise((resolve, reject) => {
      if (!key.length) {
        const a: Array<any> = [];
        this.dbState.createReadStream()
          .on('data', (data) => {
            a.push({ key: data.key.toString(), value: data.value.toString() });
          })
          .on('end', () => {
            resolve(a);
          })
          .on('error', (e) => {
            reject(e);
          });
      } else {
        this.dbState.get(key, (error, value: Buffer) => { error ? reject(error) : resolve([{ key: key, value: value.toString() }]); });
      }
    });
  }

  getLatestBlock(): BlockStruct {
    return this.latestBlock;
  }

  getHeight(): number {
    return this.height;
  }

  async getPerformance(height: number): Promise<{ timestamp: number }> {
    let ts: number;
    try {
      ts = Number((await this.dbState.get('debug-performance-' + height)).toString());
    } catch (error) {
      ts = 0;
    }
    return { timestamp: ts };
  }

  /**
   * Get the genesis block from disk
   *
   * @param {string} p - Path
   */
  static genesis(p: string): BlockStruct {
    if (!fs.existsSync(p)) {
      throw new Error('Genesis Block not found at: ' + p);
    }
    const b: BlockStruct = JSON.parse(fs.readFileSync(p).toString());
    b.hash = Blockchain.hashBlock(b);
    return b;
  }

  private static hashBlock(block: BlockStruct): string {
    const { version, previousHash, height, tx } = block;
    return Util.hash(previousHash + version + height + JSON.stringify(tx));
  }

  private async processState(block: BlockStruct) {
    if (this.server.config.debug_performance) {
      await this.dbState.put('debug-performance-' + this.height, new Date().getTime());
    }

    for (const t of block.tx) {
      for (const c of t.commands) {
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
    await this.dbState.put('asset:' + command.identAssetPair, command.identAssetPair);
  }

  private async deleteAsset(command: CommandDeleteAsset) {
    new Promise((resolve, reject) => {
      this.dbState.createReadStream()
        .on('data', (data) => {
          if (data.key.toString().includes(command.identAssetPair)) {
            this.dbState.del(data.key.toString());
          }
        })
        .on('error', (e) => {
          reject(e);
        });
    });
    await this.dbState.del('asset:' + command.identAssetPair);
  }

  private async addOrder(command: CommandAddOrder) {
    let amount: number = 0;
    command = this.deleteDotFromTheEnd(command);
    const key = 'order:' + command.identAssetPair + ':' + command.orderType + ':' + command.price;
    try {
      amount = await this.dbState.get(key);
    } catch (err) {
      Logger.error(err);
    }
    amount = (new Big(amount || 0)).toNumber();
    await this.dbState.put(key, (new Big(command.amount || 0)).plus(amount).toFixed(this.precision));
  }

  private async deleteOrder(command: CommandDeleteOrder) {
    let amount: number = 0;
    command = this.deleteDotFromTheEnd(command);
    const key = 'order:' + command.identAssetPair + ':' + command.orderType + ':' + command.price;
    try {
      amount = await this.dbState.get(key);
    } catch (err) {
      Logger.error(err);
    }
    amount = (new Big(amount || 0)).toNumber();
    if (amount > 0) {
      if (parseFloat(command.amount) >= amount) {
        await this.dbState.del(key);
      } else {
        await this.dbState.put(key, (new Big(amount || 0)).minus(new Big(command.amount || 0)).toFixed(this.precision));
      }
    }
  }

  private deleteDotFromTheEnd(command: CommandAddOrder|CommandDeleteOrder) {
    if (command.price[command.price.length - 1] === '.') {
      command.price = command.price.slice(0, -1);
    }
    if (command.amount[command.amount.length - 1] === '.') {
      command.amount = command.amount.slice(0, -1);
    }
    return command;
  }
}
