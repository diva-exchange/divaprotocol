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

interface Command {
  seq: number;
  command: string;
}

interface CommandTestLoad extends Command {
  timestamp: number;
}

export interface CommandAddPeer extends Command {
  host: string;
  port: number;
  publicKey: string;
}

export interface CommandRemovePeer extends Command {
  publicKey: string;
}

export interface CommandModifyStake extends Command {
  publicKey: string;
  stake: number;
}

export interface CommandAddOrder extends Command {
  publicKey: string;
  identAssetPair: string;
  orderType: string;
  amount: string;
  price: string;
}

export interface CommandDeleteOrder extends Command {
  publicKey: string;
  identAssetPair: string;
  orderType: string;
  amount: string;
  price: string;
}

export interface CommandAddAsset extends Command {
  publicKey: string;
  identAssetPair: string;
}

export interface CommandDeleteAsset extends Command {
  publicKey: string;
  identAssetPair: string;
}

export type ArrayCommand = Array<
  | CommandTestLoad
  | CommandAddPeer
  | CommandRemovePeer
  | CommandModifyStake
  | CommandAddOrder
  | CommandDeleteOrder
  | CommandAddAsset
  | CommandDeleteAsset
>;

export type TransactionStruct = {
  ident: string;
  origin: string;
  timestamp: number; // Format: Milliseconds (1/1,000 second)
  commands: ArrayCommand;
  sig: string;
};
