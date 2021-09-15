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
import chaiSpies from 'chai-spies';

import { Config } from '../../src/config';
import { Feeder } from '../../src/protocol/feeder';
import { BlockStruct } from '../../src/protocol/struct';
import { SubscribeManager } from '../../src/protocol/subscribeManager';
import base64url from 'base64-url';
import { OrderBook } from '../../src/protocol/orderBook';

chai.use(chaiHttp);
chai.use(chaiSpies);

const BASE_PORT = 19720;
const IP = '127.0.0.1';

@suite
class TestFeeder {
  static config: Config;
  static feeder: Feeder;
  static orderBook: OrderBook;
  static subscribeManager: SubscribeManager;
  private static data = {
    contract: 'BTC_XMR',
    channel: 'market',
    buy: [{ id: 123456789, p: '10.98765400', a: '5.09876500' }],
    sell: [],
  };
  private static testBlock: BlockStruct = {
    version: 1,
    previousHash: 'string',
    hash: 'string',
    tx: [
      {
        ident: 'test',
        origin: 'test_origin',
        timestamp: 1631704282151,
        commands: [
          {
            seq: 1,
            command: 'data',
            ns: 'DivaExchange:OrderBook:BTC_XMR',
            base64url: '',
          },
        ],
        sig: 'test_signature',
      },
    ],
    height: 1,
    votes: [
      {
        origin: 'test_origin',
        sig: 'teset_signature_vote',
      },
    ],
  };

  @timeout(10000)
  static before(): Promise<void> {
    this.config = new Config({
      ip: IP,
      port: BASE_PORT,
    });

    return new Promise(async (resolve) => {
      setTimeout(resolve, 5000);
      this.feeder = await Feeder.make(this.config);
      this.orderBook = await OrderBook.make(this.config);
      this.subscribeManager = await SubscribeManager.make();
      this.testBlock.tx[0].origin = this.config.my_public_key;
      this.testBlock.tx[0].commands[0].base64url = base64url.encode(
        JSON.stringify(this.data)
      );
    });
  }

  @test
  async testFeedProcess() {
    await TestFeeder.feeder.process(TestFeeder.testBlock).then((result) => {
      const sm = TestFeeder.subscribeManager.getSubscriptions();

      const market = TestFeeder.orderBook.getMarket(TestFeeder.data.contract);
      expect(market).to.be.an('object');
      expect(market)
        .to.have.property('contract')
        .to.eql(TestFeeder.data.contract);
      expect(market).to.have.property('channel').to.eql('market');
      expect(market).to.have.property('buy').to.be.an('array');
      expect(market).to.have.property('sell').to.be.an('array');
    });
  }
}
