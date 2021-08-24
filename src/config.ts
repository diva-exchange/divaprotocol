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

import * as path from 'path';
import * as fs from 'fs';

export type Configuration = {
  ip?: string;
  port?: number;
  path_state?: string;
  path_app?: string;
  per_message_deflate?: boolean;

};

const DEFAULT_IP = '127.0.0.1';
const DEFAULT_PORT = 19000;

export class Config {

  public readonly debug_performance: boolean;
  public readonly VERSION: string;
  public readonly ip: string;
  public readonly port: number;
  public readonly path_state: string;
  public readonly path_app: string;
  public readonly per_message_deflate: boolean;

  constructor(c: Configuration) {
    this.debug_performance = Config.tf(process.env.DEBUG_PERFORMANCE);
    this.VERSION = require(path.join(this.path_app, 'package.json')).version;
    this.per_message_deflate = c.per_message_deflate || true;

    this.ip = c.ip || process.env.IP || DEFAULT_IP;
    this.port = Config.port(c.port || process.env.PORT || DEFAULT_PORT);

    this.path_state = c.path_state || path.join(this.path_app, 'state/');
    if (!fs.existsSync(this.path_state)) {
      fs.mkdirSync(this.path_state, { mode: '755', recursive: true });
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
