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
import { Topic } from './topic';

export class Feeder {
  private readonly config: Config;
  private readonly db: Db;
  private orderBook: OrderBook = {} as OrderBook;
  private topic: Topic = {} as Topic;
  public static sendSubscribeList: boolean = false;

  static async make(config: Config): Promise<Feeder> {
    const f = new Feeder(config);
    f.orderBook = await OrderBook.make(config);
    f.topic = Topic.make();
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

  //@FIXME what's the return value of the feeder processing data from the blockchain?
  async process(block: BlockStruct) {
    Feeder.sendSubscribeList = true;
    for (const t of block.tx) {
      // const channel: string = t.origin == this.config.my_public_key ? 'nostro' : 'market';
      if (t.origin == this.config.my_public_key) {
        for (const c of t.commands) {
          //@TODO update order book with confirmation of the order
          const contract = c.ns.split(':', 3)[2];
          //const decodedData = JSON.parse(base64url.decode(c.base64url));
          //console.log(this.orderBook.get(contract));
          //return decodedData;
        }
      }
    }
  }

  public getSubscribedData() {
    //@TODO fix the json formating
    if (Feeder.sendSubscribeList) {
      let requiredOrderBookNostro: Array<JSON> = [];
      let requiredOrderBookMarket: Array<JSON> = [];
      this.topic.getTopics().forEach((topic) => {
        if (topic.channel === 'nostro') {
          requiredOrderBookNostro = requiredOrderBookNostro.concat(
            JSON.parse(this.orderBook.getNostro(topic.contract))
          );
        }
        if (topic.channel === 'market') {
          requiredOrderBookMarket = requiredOrderBookMarket.concat(
            JSON.parse(this.orderBook.getMarket(topic.contract))
          );
        }
      });
      Feeder.sendSubscribeList = false;
      return (
        '{nostro:' +
        JSON.stringify(requiredOrderBookNostro) +
        ', market:' +
        JSON.stringify(requiredOrderBookMarket) +
        '}'
      );
    }
    return '';
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
