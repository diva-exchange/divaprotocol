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

import Ajv, { ValidateFunction } from 'ajv';
import schemaContract from '../schema/contract.json';
import schemaOrder from '../schema/order.json';
import schemaSubscribe from '../schema/subscribe.json';
import schemaBook from '../schema/book.json';
import schemaRecordBuySell from '../schema/record-buy-sell.json';
import { Logger } from '../util/logger';
import { Message } from '../protocol/struct';

export class Validation {
  private static instance: Validation;

  private ajv: Ajv;
  private validateContract: ValidateFunction;
  private validateOrder: ValidateFunction;
  private validateSubscribe: ValidateFunction;

  public validateBook: ValidateFunction;

  static make() {
    if (!Validation.instance) {
      Validation.instance = new Validation();
    }
    return Validation.instance;
  }

  private constructor() {
    this.ajv = new Ajv();
    this.validateContract = this.ajv.compile(schemaContract);
    this.validateOrder = this.ajv.compile(schemaOrder);
    this.validateSubscribe = this.ajv.compile(schemaSubscribe);
    this.validateBook = this.ajv
      .addSchema(schemaRecordBuySell)
      .compile(schemaBook);
  }

  //@FIXME add validation
  validate(message: Buffer): boolean {
    try {
      const m = JSON.parse(message.toString()) as Message;
      switch (m.command) {
        case 'add':
        case 'delete':
          return this.validateOrder(m);
        case 'subscribe':
          return this.validateSubscribe(m);
        case 'unsubscribe':
          return true;
        default:
          Logger.warn('Validation.validate(): Command not supported');
          return false;
      }
    } catch (error: any) {
      Logger.trace(error);
      return false;
    }
  }
}
