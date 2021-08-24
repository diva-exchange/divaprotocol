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

import base64url from 'base64-url';
import sodium from 'sodium-native';
import fs from 'fs';
import path from 'path';
import { Config } from '../config';

export class Wallet {
  private config: Config;
  private ident: string = '';
  private readonly publicKey: Buffer;
  private readonly secretKey: Buffer;

  static make(config: Config): Wallet {
    return new Wallet(config);
  }

  private constructor(config: Config) {
    this.config = config;
    this.publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);
    this.secretKey = sodium.sodium_malloc(sodium.crypto_sign_SECRETKEYBYTES);
  }

  open(): Wallet {
    this.ident = this.config.address.replace(/[^a-z0-9_-]+/gi, '-');

    sodium.sodium_mlock(this.secretKey);

    // look for keys
    const pathPublic = path.join(this.config.path_keys, this.ident + '.public');
    const pathSecret = path.join(this.config.path_keys, this.ident + '.secret');
    if (fs.existsSync(pathPublic) && fs.existsSync(pathSecret)) {
      this.publicKey.fill(Buffer.from(base64url.unescape(fs.readFileSync(pathPublic).toString()), 'base64'));
      this.secretKey.fill(fs.readFileSync(pathSecret));
    } else {
      sodium.crypto_sign_keypair(this.publicKey, this.secretKey);

      fs.writeFileSync(pathPublic, base64url.escape(this.publicKey.toString('base64')), { mode: '0644' });
      fs.writeFileSync(pathSecret, this.secretKey, { mode: '0600' });
    }

    return this;
  }

  close() {
    sodium.sodium_munlock(this.secretKey);
  }

  /**
   * @param data {string}
   * @returns {string} - base64url encoded signature
   */
  sign(data: string): string {
    if (!this.ident) {
      this.open();
    }

    const bufferSignature: Buffer = Buffer.alloc(sodium.crypto_sign_BYTES);
    const bufferDataHash: Buffer = Buffer.from(data);

    sodium.crypto_sign_detached(bufferSignature, bufferDataHash, this.secretKey);

    return base64url.escape(bufferSignature.toString('base64'));
  }

  /**
   * @returns {string} - base64url encoded
   */
  getPublicKey(): string {
    if (!this.ident) {
      this.open();
    }
    return base64url.escape(this.publicKey.toString('base64'));
  }
}
