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
// import LevelUp from 'levelup';
// import LevelDown from 'leveldown';
import Big from 'big.js';
import { Logger } from '../logger';
import { Db } from '../transactions/db';
import { BlockStruct } from './block';
import {
    CommandAddContract,
    CommandAddOrder,
    CommandDeleteContract,
    CommandDeleteOrder, CommandOrder,
} from './transaction';
import base64url from "base64-url";

export class Feeder {
    public readonly config: Config;
    private readonly db: Db;


    private precision = 9;

    public constructor(config: Config) {
        this.config = config;
        this.db = Db.make(this.config);

        // this.dbState = LevelUp(
        //     LevelDown(this.config.path_state),
        //     {
        //         createIfMissing: true,
        //         errorIfExists: false,
        //         compression: true,
        //         cacheSize: 2 * 1024 * 1024, // 2 MB
        //     }
        // );
    }

    public async shutdown() {
        await this.db.shutdown();
    }

    public async clear() {
        await this.db.clear();
    }

    public async processState(block: BlockStruct) {
        for (const t of block.tx) {
            for (const c of t.commands) {
                if (c.command === 'data') {
                    let data = c as CommandOrder;
                    const decodedData = base64url.decode(data.base64url);
                    switch (data.ns) {
                        case 'DivaExchangeContractAdd':
                            await this.addContract(decodedData);
                            break;
                        case 'DivaExchangeContractDelete':
                            await this.deleteContract(decodedData);
                            break;
                        case 'DivaExchangeOrderAdd':
                            await this.addOrder(decodedData);
                            break;
                        case 'DivaExchangeOrderDelete':
                            await this.deleteOrder(decodedData);
                            break;
                    }
                }
            }
        }
    }

    private async addContract(data: string) {
        let jsonData = JSON.parse(data);
        await this.db.updateKey(
            'asset:' + jsonData.identAssetPair,
            jsonData.identAssetPair
        );
    }

    private async deleteContract(data: string) {
        // let jsonData = JSON.parse(data);
        // return new Promise((resolve, reject) => {
        //     this.dbState
        //         .createReadStream()
        //         .on('data', (data) => {
        //             if (data.key.toString().includes(jsonData.contract)) {
        //                 this.dbState.del(data.key.toString());
        //             }
        //         })
        //         .on('end', () => {
        //             resolve(this.dbState);
        //         })
        //         .on('error', (e) => {
        //             reject(e);
        //         });
        // });
    }

    private async addOrder(data: string) {
        let jsonData = JSON.parse(data);
        let currentMap = new Map<string, string>();
        //jsonData = Feeder.deleteDotFromTheEnd(jsonData);
        const key =
            'order:' +
            jsonData.contract +
            ':' +
            jsonData.type ;
        currentMap = await this.db.getValueByKey(key);
        let amountString = currentMap.get(jsonData.price.toString());
        let amount = new Big(amountString || 0).toNumber();
        currentMap.set(jsonData.price.toString(),new Big(jsonData.amount || 0).plus(amount).toFixed(this.precision));
        await this.db.updateKey(key,currentMap);
        Logger.info(await this.db.getValueByKey(key));
    }

    private async deleteOrder(data: string) {
        let jsonData = JSON.parse(data);
        let currentMap = new Map<string, string>();
        //jsonData = Feeder.deleteDotFromTheEnd(jsonData);
        const key =
            'order:' +
            jsonData.contract +
            ':' +
            jsonData.type;
        currentMap = await this.db.getValueByKey(key);
        let amountString = currentMap.get(jsonData.price.toString());
        let amount = new Big(amountString || 0).toNumber();
        if (amount > 0) {
            if (parseFloat(jsonData.amount) >= amount) {
                currentMap.delete(key);
            } else {
                currentMap.set(key, new Big(amount || 0)
                    .minus(new Big(jsonData.amount || 0))
                    .toFixed(this.precision))
            }
        }
        await this.db.updateKey(
            key,
            currentMap
        );
    }

    private static deleteDotFromTheEnd(
        command: CommandAddOrder | CommandDeleteOrder
    ) {
        if (command.price[command.price.length - 1] === '.') {
            command.price = command.price.slice(0, -1);
        }
        if (command.amount[command.amount.length - 1] === '.') {
            command.amount = command.amount.slice(0, -1);
        }
        return command;
    }
}
