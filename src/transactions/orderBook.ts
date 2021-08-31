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

import {Config} from "../config";
import { Db } from "../transactions/db";
import { CommandSubscribe } from "./transaction";

export class OrderBook {
    public readonly config: Config;
    private readonly db: Db;

    public constructor(config: Config) {
        this.config = config;
        this.db = Db.make(this.config);
    }

    public async getOrderBook(message: CommandSubscribe) {
        const orderBuy: Map<string, string> = await this.db.getValueByKey('order:' + message.contract + ':buy');
        const orderSell: Map<string, string> = await this.db.getValueByKey('order:' + message.contract + ':sell');
        return {
            "channel": message.channel,
            "data": { "buy": orderBuy,
                "sell": orderSell}
        };
    }
}
