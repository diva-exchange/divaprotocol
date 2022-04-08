/**
 * Copyright (C) 2021-2022 diva.exchange
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

import WebSocket from 'ws';
import { Message } from './struct';
import { Book } from '../book/orderbook';

export class SubscriptionManager {
  private readonly mapSub: Map<WebSocket, Map<string, Set<string>>>;
  private static instance: SubscriptionManager;

  public static make() {
    // Singleton
    return this.instance || (this.instance = new SubscriptionManager());
  }

  private constructor() {
    this.mapSub = new Map();
  }

  public subscribe(webSocket: WebSocket, message: Message): void {
    const map: Map<string, Set<string>> = this.mapSub.get(webSocket) || new Map();
    const subscriptions: Set<string> = map.get(message.channel) || new Set();

    subscriptions.add(message.contract);
    map.set(message.channel, subscriptions);
    this.mapSub.set(webSocket, map);
  }

  public unsubscribe(webSocket: WebSocket, message: Message): void {
    const map: Map<string, Set<string>> = this.mapSub.get(webSocket) || new Map();
    const subscriptions: Set<string> = map.get(message.channel) || new Set();

    subscriptions.delete(message.contract);
    map.set(message.channel, subscriptions);
    this.mapSub.set(webSocket, map);
  }

  public deleteSubscription(websocket: WebSocket): void {
    this.mapSub.delete(websocket);
  }

  public broadcast(contract: string, channel: string, dta: Book): void {
    this.mapSub.forEach((map, ws) => {
      if ((map.get(channel) || new Set<string>()).has(contract)) {
        ws.send(JSON.stringify({contract: contract, channel: channel, buy: dta.buy || [], sell: dta.sell || []}));
      }
    });
  }
}
