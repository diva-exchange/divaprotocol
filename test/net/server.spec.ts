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
import path from 'path';

import { Server } from '../../src/net/server';
import { Config } from '../../src/config';
import fs from 'fs';

chai.use(chaiHttp);

const BASE_PORT = 19720;
const IP = '127.0.0.1';

@suite
class TestServer {
  static mapConfigServer: Map<string, Config> = new Map();
  static mapServer: Map<string, Server> = new Map();

  // @timeout(20000)
  // static before(): Promise<void> {
  //
  //     const config = new Config({
  //       ip: IP,
  //       port: BASE_PORT,
  //       path_state: path.join(__dirname, '../state'),
  //       path_blockstore: path.join(__dirname, '../blockstore'),
  //       path_keys: path.join(__dirname, '../keys')
  //     });
  //
  //     const publicKey = "test"
  //     this.mapConfigServer.set(publicKey, config);
  //
  //   return new Promise((resolve) => {
  //     setTimeout(resolve, 9000);
  //
  //     for (const pk of TestServer.mapConfigServer.keys()) {
  //       (async () => {
  //         await TestServer.createServer(pk);
  //       })();
  //     }
  //   });
  // }
  //
  // @timeout(60000)
  // static after(): Promise<void> {
  //   return new Promise((resolve) => {
  //     let c = TestServer.mapServer.size;
  //     TestServer.mapServer.forEach(async (s) => {
  //       await s.shutdown();
  //       c--;
  //       if (!c) {
  //         setTimeout(resolve, 500);
  //       }
  //     });
  //   });
  // }
  //
  // static async createServer(publicKey: string) {
  //   const s = new Server(
  //     new Config({
  //       ...TestServer.mapConfigServer.get(publicKey),
  //       ...{
  //         path_genesis: path.join(__dirname, '../genesis/block.json'),
  //         path_blockstore: path.join(__dirname, '../blockstore'),
  //         path_state: path.join(__dirname, '../state'),
  //         path_keys: path.join(__dirname, '../keys'),
  //       },
  //     })
  //   );
  //   //await s.start();
  //   TestServer.mapServer.set(publicKey, s);
  //   return s;
  // }
  //
  // @test
  // @slow(399000)
  // @timeout(400000)
  // async default404() {
  //   const config = [...TestServer.mapConfigServer.values()][0];
  //   const res = await chai.request(`http://${config.ip}:${config.port}`).get('/');
  //   expect(res).to.have.status(404);
  //   await TestServer.wait(2000);
  // }
  //
  // @test
  // @slow(399000)
  // @timeout(400000)
  // async token() {
  //   const config = [...TestServer.mapConfigServer.values()][0];
  //   const res = await chai.request(`http://${config.ip}:${config.port}`).get('/showToken');
  //   expect(res).to.have.status(200);
  //   await TestServer.wait(9000);
  // }
  //
  // private static async wait(s: number) {
  //   // wait a bit
  //   await new Promise((resolve) => {
  //     setTimeout(resolve, s, true);
  //   });
  // }
}
