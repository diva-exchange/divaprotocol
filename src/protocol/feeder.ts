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
          if (c.command === 'data' && c.ns.includes('DivaExchange:OrderBook')) {
            const decodedJsonData = JSON.parse(base64url.decode(c.base64url));
            decodedJsonData.buy.forEach((value: tRecord) => {
              this.orderBook.updateMarket(
                value.id,
                decodedJsonData.contract,
                'buy',
                value.p,
                value.a
              );
            });
            decodedJsonData.sell.forEach((value: tRecord) => {
              this.orderBook.updateMarket(
                value.id,
                decodedJsonData.contract,
                'sell',
                value.p,
                value.a
              );
            });
          }
        }
      }
    }
  }
}
