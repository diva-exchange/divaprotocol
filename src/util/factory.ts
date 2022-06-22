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

import get from 'simple-get';
import { Logger } from './logger';

export class Factory {
  public my_public_key: string = '';
  private readonly url_api_chain: string;

  constructor(urlApiChain: string) {
    this.url_api_chain = urlApiChain;
  }

  public async getPublicKey(): Promise<string> {
    return new Promise((resolve, reject) => {
      get.concat(this.url_api_chain + '/about', (error: Error, res: any, data: any) => {
        if (error) {
          reject(error);
          return;
        }
        if (res.statusCode == 200) {
          this.my_public_key = JSON.parse(data).publicKey.toString();
        }
        resolve(JSON.parse(data).publicKey.toString());
      });
    });
  }
}
