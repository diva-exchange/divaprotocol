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
import { Logger } from '../logger';
import WebSocket, { Server as WebSocketServer } from 'ws';
import path from "path";

export class Server {
  public readonly config: Config;

  private readonly webSocketServer: WebSocketServer;
  private webSocketFeed: WebSocket | undefined;
  private height: number = 0;

  constructor(config: Config) {
    this.config = config;
    Logger.info(`divaprotocol ${this.config.VERSION} instantiating...`);

    this.webSocketServer = new WebSocketServer({host: this.config.ip, port:this.config.port});

    this.webSocketServer.on('connection', (error: Error, ws: WebSocket) => {
      ws.on('error', (err: Error, ws: WebSocket) => {
        Logger.trace(err);
        ws.close();
      });
      ws.on('message', function incoming(message: any) {
        console.log('received: %s', message);
      });
      ws.send('test');
    });
    this.webSocketServer.on('close', () => {
      Logger.info('WebSocketServer closing');
    });
  }

  /**
   * @return {WebSocket}
   * @throws {Error}
   */
  getWebsocket () {
    return new WebSocket('ws://' + this.config.ip + ':' + this.config.port)
  }

  getFeed() {
    this.webSocketFeed = new WebSocket('ws://localhost:17469', {
      followRedirects: false,
    });

    this.webSocketFeed.on('error', (error) => {Logger.trace(error);});

    this.webSocketFeed.on('close', () => {
      this.webSocketFeed = {} as WebSocket;
      setTimeout(() => { this.getFeed(); }, 1000);
    });

    this.webSocketFeed.on('message', (message: Buffer) => {
      let block: any = {};
      let html: string = '';
      try {
        block = JSON.parse(message.toString());
        this.height = block.height > this.height ? block.height : this.height;
        console.log(block);
      } catch (e) {
        return;
      }
      if (html.length) {
        this.webSocketServer.clients.forEach((ws) => {
          ws.send(JSON.stringify({ heightChain: this.height, heightBlock: block.height, html: html }));
        });
      }
    });
  }

  async shutdown(): Promise<void> {

    if (this.webSocketServer) {
      await new Promise((resolve) => {
        this.webSocketServer.close(resolve);
      });
    }
  }

  getWebSocketServer(): WebSocketServer {
    return this.webSocketServer;
  }
}
