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

import * as base64url from 'base64-url';
import * as crypto from 'crypto';
import * as sodium from 'sodium-native';

export class Util {
  /**
   * MD5 hash on a string
   *
   * @param {string} s - String to hash
   * @returns {string} Base64url encoded hash
   */
  static md5hex(s: string): string {
    return crypto.createHash('md5').update(s).digest('hex');
  }

  /**
   * @param s {string}
   * @returns {string} - hash, base64url encoded
   */
  static hash(s: string): string {
    const bufferOutput: Buffer = Buffer.alloc(sodium.crypto_hash_sha256_BYTES);
    sodium.crypto_hash_sha256(bufferOutput, Buffer.from(s));
    return base64url.escape(bufferOutput.toString('base64'));
  }

  /**
   * @param {string} publicKey - Base64url encoded
   * @param {string} sig - Base64url encoded
   * @param {string} data
   * @returns {boolean}
   */
  static verifySignature(publicKey: string, sig: string, data: string): boolean {
    return sodium.crypto_sign_verify_detached(
      Buffer.from(base64url.unescape(sig), 'base64'),
      Buffer.from(data),
      Buffer.from(base64url.unescape(publicKey), 'base64')
    );
  }

  /**
   * Shuffle an array, using Durstenfeld shuffle
   * https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
   *
   * @param {Array<any>} array
   * @return {Array<any>}
   */
  static shuffleArray(array: Array<any>) {
    const a = array.slice();
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
  }
}
