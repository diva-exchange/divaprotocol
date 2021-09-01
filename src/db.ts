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

import { Config } from './config';
import LevelUp from 'levelup';
import LevelDown from 'leveldown';
import {Logger} from "./logger";

export class Db {
    public readonly config: Config;
    private readonly dbState: InstanceType<typeof LevelUp>;
    private static dbInstance: Db;

    private constructor(config: Config) {
        this.config = config;
        this.dbState = LevelUp(
            LevelDown(this.config.path_state),
            {
                createIfMissing: true,
                errorIfExists: false,
                compression: true,
                cacheSize: 2 * 1024 * 1024, // 2 MB
            }
        );
    }

    public static make(config: Config) {
        return this.dbInstance || (this.dbInstance = new this(config));
    }

    public async updateByKey(key: string, value: string) {
        this.dbState.put(key, value);
    }

    public async getValueByKey(key: string): Promise<string> {
        try {
            return await this.dbState.get(key);
        } catch (err) {
            Logger.error(err);
        }
        return '[]';
    }

    public async deleteByKey(key: string) {
        this.dbState.del(key);
    }

    public async deleteByKeyPart(keyPart: string) {
        return new Promise((resolve, reject) => {
            this.dbState
                .createReadStream()
                .on('data', (data) => {
                    if (data.key.toString().includes(keyPart)) {
                        this.deleteByKey(data.key.toString());
                    }
                })
                .on('end', () => {
                    resolve(this.dbState);
                })
                .on('error', (e) => {
                    reject(e);
                });
        });
    }

    public async shutdown() {
        await this.dbState.close();
    }

    public async clear() {
        await this.dbState.clear();
    }
}
