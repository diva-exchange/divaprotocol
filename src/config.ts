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

import path from 'path';
import fs from 'fs';

export type Configuration = {
  ip?: string;
  port?: number;
  address?: string;
  path_state?: string;
  path_app?: string;
  per_message_deflate?: boolean;
  path_keys?: string;
  path_blockstore?: string;
  url_block_feed?: string;
};

const DEFAULT_IP = '127.0.0.1';
const DEFAULT_PORT = 19720;
const URL_BLOCK_FEED = 'ws://127.27.27.1:18001';

export class Config {
  public readonly debug_performance: boolean;
  public readonly VERSION: string;
  public readonly ip: string;
  public readonly port: number;
  public readonly url_block_feed: string;
  public address: string;
  public readonly path_state: string;
  public readonly path_app: string;
  public readonly per_message_deflate: boolean;
  public readonly path_keys: string;
  public readonly path_blockstore: string;

  constructor(c: Configuration) {
    this.path_app =
      c.path_app ||
      path.join(
        Object.keys(process).includes('pkg')
          ? path.dirname(process.execPath)
          : __dirname,
        '/../'
      );
    this.debug_performance = Config.tf(process.env.DEBUG_PERFORMANCE);
    this.VERSION = require(path.join(this.path_app, 'package.json')).version;
    this.per_message_deflate = c.per_message_deflate || true;

    this.ip = c.ip || process.env.IP || DEFAULT_IP;
    this.port = Config.port(c.port || process.env.PORT || DEFAULT_PORT);
    this.address =
      c.address || process.env.ADDRESS || this.ip + ':' + this.port;
    this.url_block_feed =
      c.url_block_feed || process.env.PORT_BLOCK || URL_BLOCK_FEED;

    this.path_state = c.path_state || path.join(this.path_app, 'state/');
    if (!fs.existsSync(this.path_state)) {
      fs.mkdirSync(this.path_state, { mode: '755', recursive: true });
    }

    this.path_keys = c.path_keys || path.join(this.path_app, 'keys/');
    if (!fs.existsSync(this.path_keys)) {
      fs.mkdirSync(this.path_keys, { mode: '755', recursive: true });
    }

    this.path_blockstore =
      c.path_blockstore || path.join(this.path_app, 'blockstore/');
    if (!fs.existsSync(this.path_blockstore)) {
      fs.mkdirSync(this.path_blockstore, { mode: '755', recursive: true });
    }
  }

  /**
   * Boolean transformation
   * Returns True or False
   *
   * @param {any} n - Anything which will be interpreted as a number
   */
  private static tf(n: any): boolean {
    return Number(n) > 0;
  }

  /**
   * Number transformation
   * Boundaries
   *
   * @param {any} n - Anything transformed to a number
   * @param {number} min - Boundary minimum
   * @param {number} max - Boundary maximum
   */
  private static b(n: any, min: number, max: number): number {
    n = Number(n);
    min = Math.floor(min);
    max = Math.ceil(max);
    return n >= min && n <= max ? Math.floor(n) : n > max ? max : min;
  }

  private static port(n: any): number {
    return Number(n) ? Config.b(Number(n), 1025, 65535) : 0;
  }
}
