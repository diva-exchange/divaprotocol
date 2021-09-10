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

import WebSocket from 'ws';
import { Message } from './struct';

export type iSubscribe = {
  nostro: Set<string>;
  market: Set<string>;
};

export class SubscribeManager {
  private _subscriptions: Map<WebSocket, iSubscribe>;
  private static _subscriberInstance: SubscribeManager;

  public static make() {
    return this._subscriberInstance || (this._subscriberInstance = new this());
  }

  private constructor() {
    this._subscriptions = new Map<WebSocket, iSubscribe>();
  }

  public setSockets(webSocket: WebSocket, message: Message): void {
    if (!this._subscriptions.has(webSocket)) {
      this._subscriptions.set(webSocket, {
        nostro: new Set<string>(),
        market: new Set<string>(),
      });
    }

    const subscribe: iSubscribe = this._subscriptions.get(webSocket) || {
      nostro: new Set<string>(),
      market: new Set<string>(),
    };

    if (message.channel === 'nostro'  ) {
      subscribe.nostro.add(message.contract);
    }
    if (message.channel === 'market') {
      subscribe.market.add(message.contract);
    }
  }

  public getSubscriptions(): Map<WebSocket, iSubscribe> {
    return this._subscriptions;
  }

  public deleteSockets(websocket: WebSocket) {
    this._subscriptions.delete(websocket);
  }
}
