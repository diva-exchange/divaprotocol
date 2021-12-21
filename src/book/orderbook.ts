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

import { Config } from '../config/config';
import get from 'simple-get';
import { Nostro, tNostro } from './nostro';
import { Validation } from '../net/validation';
import { Logger } from '../util/logger';
import { Market, tMarketBook } from './market';

export type tBuySell = 'buy' | 'sell';

export class Orderbook {
  private readonly config: Config;
  private readonly arrayNostro: { [contract: string]: Nostro } = {};
  private readonly arrayMarket: { [contract: string]: Market } = {};
  private static ob: Orderbook;

  static async make(config: Config): Promise<Orderbook> {
    if (!this.ob) {
      this.ob = new Orderbook(config);
      await this.ob.populateCompleteNostroFromChain();
    }
    return this.ob;
  }

  private constructor(config: Config) {
    this.config = config;
    this.config.contracts_array.forEach((contract) => {
      this.arrayNostro[contract] = Nostro.make(
        contract,
        config.decimalPrecision
      );
      this.arrayMarket[contract] = Market.make(
        contract,
        config.decimalPrecision
      );
    });
  }

  public addNostro(
    id: number,
    contract: string,
    type: tBuySell,
    price: number,
    amount: number
  ): void {
    if (!this.arrayNostro[contract]) {
      throw new Error('Nostro.update(): invalid contract');
    }
    switch (type) {
      case 'buy':
        this.arrayNostro[contract].buy(id, price, amount);
        break;
      case 'sell':
        this.arrayNostro[contract].sell(id, price, amount);
        break;
      default:
        throw new Error('Nostro.update(): invalid type');
    }
  }

  public deleteNostro(
    id: number,
    contract: string,
    type: 'buy' | 'sell',
    price: number | string,
    amount: number | string
  ): void {
    if (!this.arrayNostro[contract]) {
      throw new Error('Nostro.update(): invalid contract');
    }
    switch (type) {
      case 'buy':
        this.arrayNostro[contract].deleteBuy(id, price, amount);
        break;
      case 'sell':
        this.arrayNostro[contract].deleteSell(id, price, amount);
        break;
      default:
        throw new Error('Nostro.update(): invalid type');
    }
  }

  public async updateMarket(contract: string): Promise<void> {
    if (!this.arrayMarket[contract]) {
      throw new Error('Market.update(): invalid contract');
    }
    const currentState: string = await this.getState();
    if (currentState) {
      this.arrayMarket[contract] = Market.make(
        contract,
        this.config.decimalPrecision
      );
      const allData = [...JSON.parse(currentState)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 4);
        if (
          keyArray[0] === 'DivaExchange' &&
          keyArray[1] === 'OrderBook' &&
          keyArray[2] === contract
        ) {
          try {
            const book: tNostro = JSON.parse(element.value);
            if (Validation.make().validateBook(book)) {
              book.buy.forEach((r) => {
                this.arrayMarket[book.contract].buy(r.p, r.a);
              });
              book.sell.forEach((r) => {
                this.arrayMarket[book.contract].sell(r.p, r.a);
              });
            }
          } catch (error: any) {
            Logger.error(error);
          }
        }
      });
    }
  }

  public getNostro(contract: string): tNostro {
    if (!this.arrayNostro[contract]) {
      throw Error('Nostro.getNostro(): Unsupported contract');
    }
    return this.arrayNostro[contract].get();
  }

  public getMarket(contract: string): tMarketBook {
    if (!this.arrayMarket[contract]) {
      throw Error('Nostro.getMarket(): Unsupported contract');
    }
    return this.arrayMarket[contract].get();
  }

  private async populateCompleteNostroFromChain(): Promise<void> {
    const data: string = await this.getState();
    if (data) {
      const allData = [...JSON.parse(data)];
      allData.forEach((element) => {
        const keyArray: Array<string> = element.key.toString().split(':', 4);
        if (
          keyArray[0] === 'DivaExchange' &&
          keyArray[1] === 'OrderBook' &&
          this.config.contracts_array.includes(keyArray[2])
        ) {
          try {
            const book: tNostro = JSON.parse(element.value);
            const channel =
              keyArray[keyArray.length - 1] === this.config.my_public_key
                ? 'nostro'
                : 'market';
            if (Validation.make().validateBook(book)) {
              if (channel === 'nostro') {
                book.buy.forEach((r) => {
                  this.arrayNostro[book.contract].buy(r.id, r.p, r.a);
                });
                book.sell.forEach((r) => {
                  this.arrayNostro[book.contract].sell(r.id, r.p, r.a);
                });
              }
              book.buy.forEach((r) => {
                this.arrayMarket[book.contract].buy(r.p, r.a);
              });
              book.sell.forEach((r) => {
                this.arrayMarket[book.contract].sell(r.p, r.a);
              });
            }
          } catch (error: any) {
            Logger.error(error);
          }
        }
      });
    }
  }

  private getState(): Promise<string> {
    const url: string = this.config.url_api_chain + '/state/';
    return new Promise((resolve, reject) => {
      get.concat(url, (error: Error, res: any, data: any) => {
        if (error || res.statusCode !== 200) {
          reject(error || res.statusCode);
        }
        resolve(data);
      });
    });
  }
}
