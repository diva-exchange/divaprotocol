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
import { BusinessProtocol } from '../transactions/businessProtocol';

export class Server {
  public readonly config: Config;
  public readonly businessProtocol: BusinessProtocol;

  private readonly webSocketServer: WebSocketServer;
  private webSocketFeed: WebSocket | undefined;

  constructor(config: Config) {
    this.config = config;
    this.businessProtocol = new BusinessProtocol(this.config);

    Logger.info(`divaprotocol ${this.config.VERSION} instantiating...`);

    this.webSocketServer = new WebSocketServer({
      host: this.config.ip,
      port: this.config.port,
    });
    Logger.info(`WebSocket Server listening on ${this.config.ip}:${this.config.port}`);

    this.webSocketServer.on('connection', (ws: WebSocket) => {
      ws.on('error', (err: Error) => {
        Logger.trace(err);
      });
      ws.on('message', (message: Buffer) => {
        // incoming subscription data must be processed here
        console.log('received: %s', message.toString());
      });
    });

    this.webSocketServer.on('close', () => {
      Logger.info('WebSocketServer closing');
    });
  }

  /**
   * @return {WebSocket}
   * @throws {Error}
   */
  getWebsocket() {
    return new WebSocket('ws://' + this.config.ip + ':' + this.config.port);
  }

  initFeed() {
    this.webSocketFeed = new WebSocket(this.config.url_block_feed, {
      followRedirects: false,
    });

    this.webSocketFeed.on('error', (error) => {
      Logger.trace(error);
    });

    this.webSocketFeed.on('close', () => {
      this.webSocketFeed = {} as WebSocket;
      setTimeout(() => {
        this.initFeed();
      }, 1000);
    });

    this.webSocketFeed.on('message', (message: Buffer) => {
      let block: any = {};
      try {
        block = JSON.parse(message.toString());
        console.log(block.tx[0].commands[0]);

        // business protocol
        this.businessProtocol.processState(block);

        // if it qualifies, forward the relevant object
        this.webSocketServer.clients.forEach((ws) => {
          // here should be a stringified object instead of message.toString()
          // probably only to specific subscribers
          ws.send(message.toString());
        });
      } catch (e) {
        return;
      }
    });
  }

  async shutdown(): Promise<void> {
    await this.businessProtocol.shutdown();
    await this.businessProtocol.clear();
    return new Promise((resolve) => {
      this.webSocketServer.clients.forEach((ws) =>  { ws.terminate(); });
      this.webSocketServer.close(() => { resolve(); });
    });
  }

  getWebSocketServer(): WebSocketServer {
    return this.webSocketServer;
  }
}
