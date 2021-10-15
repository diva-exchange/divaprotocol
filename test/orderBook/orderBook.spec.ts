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

import { suite, test, slow, timeout } from '@testdeck/mocha';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';

import { Config } from '../../src/config';
import { OrderBook } from '../../src/orderBook/nostro';

chai.use(chaiHttp);

const BASE_PORT = 19720;
const IP = '127.0.0.1';

@suite
class TestOderBook {
  static config: Config;
  static orderBook: OrderBook;
  private expectedBuyObj: Array<Object> = [
    { id: 123456789, p: '10.98765400', a: '5.09876500' },
  ];
  private expectedSellObj: Array<Object> = [
    { id: 987654321, p: '17.98765400', a: '75.09876500' },
  ];
  private notExistContract: string = 'NOT_EXIST';

  @timeout(10000)
  static before(): Promise<void> {
    this.config = new Config({
      ip: IP,
      port: BASE_PORT,
    });

    return new Promise(async (resolve) => {
      setTimeout(resolve, 5000);
      this.orderBook = await OrderBook.make(this.config);
    });
  }

  @timeout(7000)
  static after(): Promise<void> {
    return new Promise((resolve) => {
      resolve();
    });
  }

  @test
  testAddNostroFail() {
    // CONTRACT DOES NOT EXIST
    expect(() => {
      TestOderBook.orderBook.addNostro(
        123456789,
        this.notExistContract,
        'buy',
        10.987654,
        5.098765
      );
    }).to.throw('OrderBook.update(): invalid contract');
  }

  @test
  testAddNostroBuy() {
    // BUY
    TestOderBook.orderBook.addNostro(
      123456789,
      'BTC_XMR',
      'buy',
      10.987654,
      5.098765
    );
    const orderBookNostroBuy = TestOderBook.orderBook.getNostro('BTC_XMR').buy;

    expect(orderBookNostroBuy).to.be.instanceOf(Array);
    expect(orderBookNostroBuy).to.deep.include.members(this.expectedBuyObj);
  }

  @test
  testAddNostroSell() {
    // SELL
    TestOderBook.orderBook.addNostro(
      987654321,
      'BTC_XMR',
      'sell',
      17.987654,
      75.098765
    );
    const orderBookNostroSell =
      TestOderBook.orderBook.getNostro('BTC_XMR').sell;

    expect(orderBookNostroSell).to.be.instanceOf(Array);
    expect(orderBookNostroSell).to.deep.include.members(this.expectedSellObj);
  }

  @test
  testUpdateMarketFail() {
    return TestOderBook.orderBook
      .updateMarket(this.notExistContract)
      .then((result) => {
        throw new Error('CONTRACT DOES NOT EXIST');
      })
      .catch((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('OrderBook.update(): invalid contract');
      });
  }

  @test
  testUpdateMarket() {
    TestOderBook.orderBook.updateMarket('BTC_ETH').then((result) => {
      const orderBookMarket = TestOderBook.orderBook.getMarket('BTC_XMR');

      expect(orderBookMarket).to.be.instanceOf(Object);
      expect(orderBookMarket)
        .to.have.property('buy')
        .to.eql(this.expectedBuyObj);
      expect(orderBookMarket)
        .to.have.property('sell')
        .to.eql(this.expectedSellObj);
    });
  }

  @test
  testDeleteNostroFail() {
    // CONTRACT DOES NOT EXIST
    expect(() => {
      TestOderBook.orderBook.deleteNostro(
        123456789,
        this.notExistContract,
        'buy',
        10.987654,
        5.098765
      );
    }).to.throw('OrderBook.update(): invalid contract');
  }

  @test
  testDeleteNostroBuy() {
    // BUY

    TestOderBook.orderBook.deleteNostro(
      123456789,
      'BTC_XMR',
      'buy',
      10.987654,
      5.098765
    );
    const orderBookNostroBuy = TestOderBook.orderBook.getNostro('BTC_XMR');

    expect(orderBookNostroBuy).to.be.instanceOf(Object);
    expect(orderBookNostroBuy).to.have.property('buy').to.eql([]);
  }

  @test
  testDeleteNostroSell() {
    // SELL
    TestOderBook.orderBook.deleteNostro(
      987654321,
      'BTC_XMR',
      'sell',
      17.987654,
      75.098765
    );
    const orderBookNostroSell = TestOderBook.orderBook.getNostro('BTC_XMR');

    expect(orderBookNostroSell).to.be.instanceOf(Object);
    expect(orderBookNostroSell).to.have.property('sell').to.eql([]);
  }

  @test
  testGetNostroFail() {
    // CONTRACT DOES NOT EXIST
    expect(() => {
      TestOderBook.orderBook.getNostro(this.notExistContract);
    }).to.throw('OrderBook.getNostro(): Unsupported contract');
  }

  @test
  testGetMarketFail() {
    // CONTRACT DOES NOT EXIST
    expect(() => {
      TestOderBook.orderBook.getMarket(this.notExistContract);
    }).to.throw('OrderBook.getMarket(): Unsupported contract');
  }

  private static async wait(s: number) {
    // wait a bit
    await new Promise((resolve) => {
      setTimeout(resolve, s, true);
    });
  }
}
