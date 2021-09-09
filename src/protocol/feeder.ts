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
import { Db } from '../db';
import { BlockStruct } from './struct';
import { OrderBook } from './orderBook';
import base64url from 'base64-url';
import { tRecord } from './book';
import { Big } from 'big.js';

export class Feeder {
  private readonly config: Config;
  private readonly db: Db;
  private orderBook: OrderBook = {} as OrderBook;

  static async make(config: Config): Promise<Feeder> {
    const f = new Feeder(config);
    f.orderBook = await OrderBook.make(config);
    return f;
  }

  private constructor(config: Config) {
    this.config = config;
    this.db = Db.make(this.config);
  }

  async shutdown() {
    await this.db.shutdown();
  }

  async clear() {
    await this.db.clear();
  }

  async process(block: BlockStruct) {
    for (const t of block.tx) {
      if (t.origin == this.config.my_public_key) {
        for (const c of t.commands) {
          //const contract = c.ns.split(':', 3)[2];
          // const decodedData = JSON.parse(base64url.decode(c.base64url));
          // decodedData.buy.forEach((value: tRecord, index: tRecord) => {
          //   this.orderBook.updateMarket(value.id, decodedData.contract, 'buy', value.p, value.a);
          // });
          // decodedData.sell.forEach((value: tRecord, index: tRecord) => {
          //   this.orderBook.updateMarket(value.id, decodedData.contract, 'sell', value.p, value.a);
          // });
        }
      }
    }
  }

  /*
  private async addContract(data: CommandContract) {
    await this.db.updateByKey('asset:' + data.contract, {});
  }

  private async deleteContract(data: CommandContract) {
    await this.db.deleteByKeyPart(data.contract);
  }

  private async addMarketOrder(data: CommandOrder) {
    data = Feeder.deleteDotFromTheEnd(data);
    const key: string = this.getMarketOrderKey(data);
    const mapKey: string = data.price.toString();
    const currentMap: Map<string, string> = new Map(
      await this.db.getValueByKey(key)
    );
    const amountString: string = currentMap.get(mapKey) || '0';
    const amount = new Big(amountString || 0).toNumber();
    const newAmount = new Big(data.amount || 0)
      .plus(amount)
      .toFixed(this.precision);
    currentMap.set(mapKey, newAmount);
    Logger.trace(JSON.stringify([...currentMap.entries()]));
    await this.db.updateByKey(key, [...currentMap.entries()]);
  }

  private async deleteMarketOrder(data: CommandOrder) {
    data = Feeder.deleteDotFromTheEnd(data);
    const key: string = this.getMarketOrderKey(data);
    const mapKey: string = data.price.toString();
    const currentMap: Map<string, string> = new Map(
      await this.db.getValueByKey(key)
    );
    const amountString: string = currentMap.get(mapKey) || '0';
    const amount = new Big(amountString || 0).toNumber();
    if (amount > 0) {
      if (parseFloat(data.amount) >= amount) {
        currentMap.delete(key);
      } else {
        currentMap.set(
          key,
          new Big(amount || 0)
            .minus(new Big(data.amount || 0))
            .toFixed(this.precision)
        );
      }
    }
    await this.db.updateByKey(key, [...currentMap.entries()]);
  }

  private getMarketOrderKey(data: CommandOrder): string {
    const key = 'order_market:' + data.contract + ':' + data.type;
    return key;
  }

  //@FIXME there cannot be any "invalid" data in the feeder
  //  Reason: the feeder only accepts or drops data - but never fixes it
  private static deleteDotFromTheEnd(data: CommandOrder) {
    if (data.price[data.price.length - 1] === '.') {
      data.price = data.price.slice(0, -1);
    }
    if (data.amount[data.amount.length - 1] === '.') {
      data.amount = data.amount.slice(0, -1);
    }
    return data;
  }
  */
}
