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
import Big from 'big.js';
import { Db } from '../transactions/db';
import { BlockStruct } from './block';
import {
    CommandOrder,
    CommandContract,
    CommandData
} from './transaction';
import base64url from "base64-url";

export class Feeder {
    public readonly config: Config;
    private readonly db: Db;

    private precision = 9;

    public constructor(config: Config) {
        this.config = config;
        this.db = Db.make(this.config);
    }

    public async processState(block: BlockStruct) {
        for (const t of block.tx) {
            for (const c of t.commands) {
                if (c.command === 'data') {
                    let data = c as CommandData;
                    const decodedData = JSON.parse(base64url.decode(data.base64url));
                    switch (data.ns) {
                        case 'DivaExchangeContractAdd':
                            await this.addContract(decodedData as CommandContract);
                            break;
                        case 'DivaExchangeContractDelete':
                            await this.deleteContract(decodedData as CommandContract);
                            break;
                        case 'DivaExchangeOrderAdd':
                            await this.addOrder(decodedData  as CommandOrder);
                            break;
                        case 'DivaExchangeOrderDelete':
                            await this.deleteOrder(decodedData  as CommandOrder);
                            break;
                    }
                }
            }
        }
    }

    private async addContract(data: CommandContract) {
        await this.db.updateKey(
            'asset:' + data.contract,
            new Map<string, string>()
        );
    }

    private async deleteContract(data: CommandContract) {
        await this.db.deleteByKeyPart(data.contract);
    }

    private async addOrder(data: CommandOrder) {
        data = Feeder.deleteDotFromTheEnd(data);
        const key = this.getOrderKey(data);
        const currentMap = await this.db.getValueByKey(key);
        let amountString = currentMap.get(data.price.toString());
        let amount = new Big(amountString || 0).toNumber();
        currentMap.set(data.price.toString(),new Big(data.amount || 0).plus(amount).toFixed(this.precision));
        await this.db.updateKey(key,currentMap);
    }

    private async deleteOrder(data: CommandOrder) {
        data = Feeder.deleteDotFromTheEnd(data);
        const key = this.getOrderKey(data);
        const currentMap = await this.db.getValueByKey(key);
        let amountString = currentMap.get(data.price.toString());
        let amount = new Big(amountString || 0).toNumber();
        if (amount > 0) {
            if (parseFloat(data.amount) >= amount) {
                currentMap.delete(key);
            } else {
                currentMap.set(key, new Big(amount || 0)
                    .minus(new Big(data.amount || 0))
                    .toFixed(this.precision))
            }
        }
        await this.db.updateKey(
            key,
            currentMap
        );
    }

    private getOrderKey(data: CommandOrder) {
        const key =
            'order:' +
            data.contract +
            ':' +
            data.type;
        return key;
    }

    private static deleteDotFromTheEnd(data: CommandOrder) {
        if (data.price[data.price.length - 1] === '.') {
            data.price = data.price.slice(0, -1);
        }
        if (data.amount[data.amount.length - 1] === '.') {
            data.amount = data.amount.slice(0, -1);
        }
        return data;
    }

    public async shutdown() {
        await this.db.shutdown();
    }

    public async clear() {
        await this.db.clear();
    }
}
