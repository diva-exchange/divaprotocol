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

import { Config } from '../config';
import LevelUp from 'levelup';
import LevelDown from 'leveldown';
import Big from 'big.js';
import { Logger } from '../logger';
import { BlockStruct } from './block';
import {
    CommandAddContract,
    CommandAddOrder,
    CommandDeleteContract,
    CommandDeleteOrder,
} from './transaction';

export class Db {
    public readonly config: Config;
    private readonly dbState: InstanceType<typeof LevelUp>;

    constructor(config: Config) {
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

    async shutdown() {
        await this.dbState.close();
    }

    async clear() {
        await this.dbState.clear();
    }
}
