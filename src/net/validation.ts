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

import Ajv from "ajv"
import { BlockStruct } from '../chain/block';
import { Logger } from '../logger';
import {
  CommandAddAsset,
  CommandAddOrder,
  CommandDeleteAsset,
  CommandDeleteOrder,
  CommandModifyStake,
  CommandRemovePeer,
  TransactionStruct,
} from '../chain/transaction';
import { Util } from '../chain/util';
import * as schemaAddAsset from '../schema/transaction/addAsset.json';
import * as schemaDeleteAsset from '../schema/transaction/deleteAsset.json';
import * as schemaAddOrder from '../schema/transaction/addOrder.json';
import * as schemaDeleteOrder from '../schema/transaction/deleteOrder.json';

export class Validation {

  static init() {
    const ajv = new Ajv();
    ajv.addSchema(schemaAddAsset, 'addAsset');
    ajv.addSchema(schemaDeleteAsset, 'deleteAsset');
    ajv.addSchema(schemaAddOrder, 'addOrder');
    ajv.addSchema(schemaDeleteOrder, 'deleteOrder');
  }

  static validateTx(tx: TransactionStruct): boolean {
    const commandsArray = ['testLoad', 'addPeer', 'removePeer', 'modifyStake', 'addAsset', 'deleteAsset', 'addOrder', 'deleteOrder'];
    for (const c of tx.commands) {
      if (!commandsArray.includes(c.command)) {
        return false;
      }
    }

    // Schema validation


    // Protocol validation
    let result = true;
    for (const c of tx.commands) {
      switch (c.command) {
        case 'addPeer':
          break;
        case 'removePeer':
          result = (c as CommandRemovePeer).publicKey === tx.origin;
          break;
        case 'modifyStake':
          result = (c as CommandModifyStake).publicKey !== tx.origin;
          break;
        case 'addAsset':
          result = (c as CommandAddAsset).publicKey === tx.origin;
          break;
        case 'deleteAsset':
          result = (c as CommandDeleteAsset).publicKey === tx.origin;
          break;
        case 'addOrder':
          result = this.validateOrder(c as CommandAddOrder, tx.origin);
          break;
        case 'deleteOrder':
          result = this.validateOrder(c as CommandDeleteOrder, tx.origin);
          break;
      }
      if (!result) {
        Logger.warn(`Validation.validateTx failed: ${c.seq} - ${c.command}`);
        Logger.trace(tx);
        return false;
      }
    }

    return Util.verifySignature(tx.origin, tx.sig, tx.ident + tx.timestamp + JSON.stringify(tx.commands));
  }

  static validateBlock(block: BlockStruct): boolean {
    if (Util.hash(block.previousHash + block.version + block.height + JSON.stringify(block.tx)) !== block.hash) {
      //@FIXME logging
      Logger.warn('Invalid block hash');
      return false;
    }

    // if (block.tx.length > MAX_TRANSACTIONS) {
    //   //@FIXME logging
    //   Logger.warn('Invalid block tx length');
    //   return false;
    // }

    const _aOrigin: Array<string> = [];
    for (const tx of block.tx) {
      if (_aOrigin.includes(tx.origin)) {
        //@FIXME logging
        Logger.trace(JSON.stringify(block.tx));
        Logger.warn(`Multiple transactions from same origin: ${block.height}`);
        return false;
      }
      _aOrigin.push(tx.origin);

      if (!Validation.validateTx(tx)) {
        return false;
      }
    }

    return true;
  }

  private static validateOrder(c: CommandAddOrder|CommandDeleteOrder, publicKey: string) {
    if (!this.isNumber(c.price) || !this.isNumber(c.amount) || c.publicKey !== publicKey) {
      return false;
    }
    return true;
  }

  private static isNumber(input: string) {
    return (parseFloat(input) - 0) == parseFloat(input) && (''+input).trim().length > 0 && parseFloat(input) > 0;
  }
}
