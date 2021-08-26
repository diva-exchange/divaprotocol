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

import Ajv from 'ajv';
import schemaAddAsset from '../schema/addAsset.json';
import schemaDeleteAsset from '../schema/deleteAsset.json';
import schemaAddOrder from '../schema/addOrder.json';
import schemaDeleteOrder from '../schema/deleteOrder.json';

export const ajv = new Ajv();

ajv.addSchema(schemaAddAsset, 'addAsset');
ajv.addSchema(schemaDeleteAsset, 'deleteAsset');
ajv.addSchema(schemaAddOrder, 'addOrder');
ajv.addSchema(schemaDeleteOrder, 'deleteOrder');
