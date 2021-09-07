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

export interface CommandData {
  seq: number;
  command: string;
  ns: string;
  base64url: string;
}

export type TransactionStruct = {
  ident: string;
  origin: string;
  timestamp: number; // Format: Milliseconds (1/1,000 second)
  commands: Array<CommandData>;
  sig: string;
};

export type BlockStruct = {
  version: number;
  previousHash: string;
  hash: string;
  tx: Array<TransactionStruct>;
  height: number;
  votes: Array<{ origin: string; sig: string }>;
};

interface iMessage {
  seq: number;
  command: string;
  contract: string;
}

export interface MessageOrder extends iMessage {
  id: number;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
}

export interface MessageSubscribe extends iMessage {
  channel: string;
}

export interface Message extends MessageOrder, MessageSubscribe {}
