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
    CommandDeleteOrder, CommandOrder,
} from './transaction';
import base64url from "base64-url";

export class Feeder {
    public readonly config: Config;
    private readonly dbState: InstanceType<typeof LevelUp>;

    private precision = 9;

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

    async processState(block: BlockStruct) {
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
        await this.dbState.put(
            'asset:' + jsonData.identAssetPair,
            jsonData.identAssetPair
        );
    }

    private async deleteContract(data: string) {
        // return new Promise((resolve, reject) => {
        //     this.dbState
        //         .createReadStream()
        //         .on('data', (data) => {
        //             if (data.key.toString().includes(command.identAssetPair)) {
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
        try {
            currentMap = await this.dbState.get(key);
        } catch (err) {
            Logger.error(err);
        }
        let amountString = currentMap.get(jsonData.price.toString());
        let amount = new Big(amountString || 0).toNumber();
        currentMap.set(jsonData.price.toString(),new Big(jsonData.amount || 0).plus(amount).toFixed(this.precision));
        await this.dbState.put(key,currentMap);

        console.log(await this.dbState.get(key));
    }

    private async deleteOrder(data: string) {
        // let currentMap = new Map<string, string>();
        // command = Feeder.deleteDotFromTheEnd(command);
        // const key =
        //     'order:' +
        //     command.identAssetPair +
        //     ':' +
        //     command.orderType;
        // try {
        //     currentMap = await this.dbState.get(key);
        // } catch (err) {
        //     Logger.error(err);
        // }
        // let amountString = currentMap.get(command.price.toString());
        // let amount = new Big(amountString || 0).toNumber();
        // if (amount > 0) {
        //     if (parseFloat(command.amount) >= amount) {
        //         currentMap.delete(key);
        //     } else {
        //         currentMap.set(key, new Big(amount || 0)
        //             .minus(new Big(command.amount || 0))
        //             .toFixed(this.precision))
        //     }
        // }
        // await this.dbState.put(
        //     key,
        //     currentMap
        // );
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
