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
  path_state?: string;
  path_app?: string;
  per_message_deflate?: boolean;
  path_keys?: string;
  url_block_feed?: string;
  url_api_chain?: string;
  my_public_key?: string;
  contracts_array?: Array<string>;
};

const DEFAULT_IP = '127.0.0.1';
const DEFAULT_PORT = 19720;
const DEFAULT_URL_BLOCK_FEED = 'ws://172.19.72.21:17469';
const DEFAULT_URL_API_CHAIN = 'http://172.19.72.21:17468';

export class Config {
  public readonly VERSION: string;
  public readonly ip: string;
  public readonly port: number;
  public readonly url_block_feed: string;
  public readonly url_api_chain: string;
  public readonly path_state: string;
  public readonly path_app: string;
  public readonly per_message_deflate: boolean;
  public readonly path_keys: string;
  public my_public_key: string = '';
  public contracts_array: Array<string> = ['BTC_XMR', 'BTC_ETH', 'BTC_ZEC'];
  public readonly waitingPeriod: number = 9;
  public readonly decimalPrecision: number = 8;
  public readonly ns_first_part = 'DivaExchange:';
  public readonly ns_order_book = 'OrderBook:';
  public readonly ns_settlement = 'Settlement:';
  public readonly ns_auction = 'Auction:';
  public readonly decision = 'decision';
  public readonly decision_taken = 'decision:taken:';

  constructor(c: Configuration) {
    this.path_app =
      c.path_app ||
      path.join(Object.keys(process).includes('pkg') ? path.dirname(process.execPath) : __dirname, '/../../');
    try {
      this.VERSION = fs.readFileSync(path.join(__dirname, 'version')).toString();
    } catch (error) {
      if (!fs.existsSync(path.join(this.path_app, 'package.json'))) {
        throw new Error('File not found: ' + path.join(this.path_app, 'package.json'));
      }
      this.VERSION = require(path.join(this.path_app, 'package.json')).version;
    }
    this.per_message_deflate = c.per_message_deflate || true;

    this.ip = c.ip || process.env.IP || DEFAULT_IP;
    this.port = Config.port(c.port || process.env.PORT || DEFAULT_PORT);
    this.url_block_feed = c.url_block_feed || process.env.URL_BLOCK_FEED || DEFAULT_URL_BLOCK_FEED;
    this.url_api_chain = c.url_api_chain || process.env.URL_API_CHAIN || DEFAULT_URL_API_CHAIN;

    this.path_state = c.path_state || path.join(this.path_app, 'state/');
    if (!fs.existsSync(this.path_state)) {
      fs.mkdirSync(this.path_state, { mode: '755', recursive: true });
    }

    this.path_keys = c.path_keys || path.join(this.path_app, 'keys/');
    if (!fs.existsSync(this.path_keys)) {
      fs.mkdirSync(this.path_keys, { mode: '755', recursive: true });
    }
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
