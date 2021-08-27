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

chai.use(chaiHttp);

const BASE_PORT = 19720;
const IP = '127.0.0.1';
const config = new Config({
  ip: IP,
  port: BASE_PORT,
});

@suite
class TestWserver {
  static server: Server;

  @timeout(20000)
  static before() {
    this.server = new Server(config);
  }

  @timeout(60000)
  static async after() {
    await this.server.shutdown();
  }

  @test
  @slow(399000)
  @timeout(400000)
  async default404() {
    const res = await chai.request(`ws://${config.ip}:${config.port}`).get('/');
    expect(res).to.have.status(404);
  }
}
