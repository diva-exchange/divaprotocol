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
  ns: string,
  base64url: string;
}

interface Command {
  command: string;
  channel: string;
  contract: string;
}

export interface CommandOrder extends Command{
  seq: number;
  type: string;
  amount: string;
  price: string;
}

export interface CommandContract  extends Command{
  seq: number;
}

export interface CommandSubscribe  extends Command{
}

export type ArrayCommand = Array<
  | CommandData
  | CommandOrder
  | CommandContract
>;

export type TransactionStruct = {
  ident: string;
  origin: string;
  timestamp: number; // Format: Milliseconds (1/1,000 second)
  commands: ArrayCommand;
  sig: string;
};
