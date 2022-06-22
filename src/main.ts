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

import { Server } from './net/server';
import { Config, Configuration } from './config/config';
import { Factory } from './util/factory';

const c: Configuration = {} as Configuration;

class Main {
  private readonly config: Config;
  public factory: Factory;

  constructor(c: Configuration) {
    this.config = new Config(c);
    this.factory = new Factory(this.config.url_api_chain);
    this.start();
  }

  private start() {
    (async () => {
      this.config.my_public_key = await this.factory.getPublicKey();
      const server = await Server.make(this.config);
      ['SIGINT', 'SIGTERM'].forEach((sig) => {
        process.once(sig, () => {
          server.shutdown();
          process.exit(0);
        });
      });
    })();
  }
}

new Main(c);
