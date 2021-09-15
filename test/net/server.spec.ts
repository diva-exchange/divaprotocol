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

import { Server } from '../../src/net/server';
import { Config } from '../../src/config';
import { Factory } from '../../src/factory';
import WebSocket from 'ws';
import Buffer from 'buffer';

chai.use(chaiHttp);

const BASE_PORT = 19720;
const IP = '127.0.0.1';

@suite
class TestServer {
  static server: Server;
  static config: Config;
  static testWebsocket: WebSocket;

  @timeout(10000)
  static before(): Promise<void> {
    this.config = new Config({
      ip: IP,
      port: BASE_PORT,
    });

    return new Promise(async (resolve) => {
      setTimeout(resolve, 5000);
      this.server = await Server.make(this.config);
      this.testWebsocket = new WebSocket(
        `ws://${TestServer.config.ip}:${TestServer.config.port}/`
      );
    });
  }

  @timeout(7000)
  static after(): Promise<void> {
    return new Promise((resolve) => {
      this.server.shutdown();
      this.testWebsocket.terminate();
      resolve();
    });
  }

  @test
  @slow(4000)
  @timeout(5000)
  async default426() {
    await TestServer.wait(3000);
    const res = chai
      .request(`ws://${TestServer.config.ip}:${TestServer.config.port}`)
      .get('/');
    expect(res); // Upgrade Required
  }

  @test
  async testPublicKey() {
    const publicKey = await new Factory(
      TestServer.config.url_api_chain
    ).getPublicKey();
    expect(publicKey).to.match(/^[A-Za-z0-9_-]{43}$/);
  }

  @test
  subscribeToNostroBTCXMR() {
    const subscribe = {
      channel: 'nostro',
      command: 'subscribe',
      contract: 'BTC_XMR',
    };
    TestServer.testWebsocket.send(JSON.stringify(subscribe));
  }

  @test
  subscribeToMarketBTCXMR() {
    const subscribe = {
      channel: 'market',
      command: 'subscribe',
      contract: 'BTC_XMR',
    };
    TestServer.testWebsocket.send(JSON.stringify(subscribe));
  }

  @test
  @slow(6000)
  @timeout(7000)
  buyOrderTest(done) {
    const orderObject = {
      seq: 1,
      command: 'add',
      type: 'buy',
      price: '10.987654',
      amount: '5.098765',
      contract: 'BTC_XMR',
      id: 123456789,
    };
    const responseBuyObj: Array<Object> = [
      { id: 123456789, p: '10.98765400', a: '5.09876500' },
    ];

    TestServer.testWebsocket.send(JSON.stringify(orderObject));

    TestServer.testWebsocket.on('message', async (message: Buffer) => {
      const response = JSON.parse(message.toString());
      expect(response.channel).equal('nostro');
      expect(response.contract).equal('BTC_XMR');
      expect(response.sell).instanceOf(Array);
      expect(response.buy)
        .to.be.an('Array')
        .to.deep.include.members(responseBuyObj);
    });
    done();
  }

  @test
  @slow(6000)
  @timeout(7000)
  buyDeleteTest(done) {
    const orderObject = {
      seq: 1,
      command: 'delete',
      type: 'buy',
      price: '10.987654',
      amount: '5.098765',
      contract: 'BTC_XMR',
      id: 123456789,
    };
    const responseObject = {};

    TestServer.testWebsocket.send(JSON.stringify(orderObject));
    TestServer.testWebsocket.on('message', async (message: Buffer) => {
      const response = JSON.parse(message.toString());
      expect(response.channel).equal('nostro');
      expect(response.contract).equal('BTC_XMR');
    });
    done();
  }

  private static async wait(s: number) {
    // wait a bit
    await new Promise((resolve) => {
      setTimeout(resolve, s, true);
    });
  }
}
