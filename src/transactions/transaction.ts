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

interface CommandData {
  ns: string,
  base64url: string;
}

export interface CommandOrder extends CommandData{
  command: string;
  seq: number;
  channel: string;
  type: string;
  amount: string;
  price: string;
  contract: string;
}

export interface CommandContract {
  command: string;
  seq: number;
  channel: string;
}

export interface CommandSubscribe {
  command: string;
  channel: string;
  contract: string;
}

export interface CommandAddOrder {
  command: string;
  seq: number;
  publicKey: string;
  identAssetPair: string;
  orderType: string;
  amount: string;
  price: string;
}

export interface CommandDeleteOrder {
  command: string;
  seq: number;
  contract: string;
  type: string;
  amount: string;
  price: string;
}

export interface CommandAddContract {
  command: string;
  seq: number;
  publicKey: string;
  identAssetPair: string;
}

export interface CommandDeleteContract {
  command: string;
  seq: number;
  publicKey: string;
  identAssetPair: string;
}

export type ArrayCommand = Array<
  | CommandOrder
  | CommandContract
  | CommandAddOrder
  | CommandDeleteOrder
  | CommandAddContract
  | CommandDeleteContract
>;

export type TransactionStruct = {
  ident: string;
  origin: string;
  timestamp: number; // Format: Milliseconds (1/1,000 second)
  commands: ArrayCommand;
  sig: string;
};
