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
import { Feeder } from '../transactions/feeder';
import { BusinessProtocol } from '../transactions/businessProtocol';
import * as Buffer from 'buffer';

export class Server {
  public readonly config: Config;
  public readonly businessProtocol: BusinessProtocol;
  public readonly feeder: Feeder;

  private readonly webSocketServer: WebSocketServer;
  private webSocketFeed: WebSocket | undefined;

  constructor(config: Config) {
    this.config = config;
    this.businessProtocol = new BusinessProtocol(this.config);
    this.feeder = new Feeder(this.config);

    Logger.info(`divaprotocol ${this.config.VERSION} instantiating...`);

    this.webSocketServer = new WebSocketServer({
      host: this.config.ip,
      port: this.config.port,
    });
    Logger.info(
      `WebSocket Server listening on ${this.config.ip}:${this.config.port}`
    );

    this.webSocketServer.on('connection', (ws: WebSocket) => {
      ws.on('error', (err: Error) => {
        Logger.warn(err);
      });
      ws.on('message', async (message: Buffer) => {
        // incoming subscription data must be processed here
        try {
          await this.businessProtocol.processOrder(
            JSON.parse(message.toString())
          );
        } catch (err) {
          Logger.trace(err);
          ws.send(404);
        }
        //@FIXME logging
        Logger.trace(
          `received to webSocketServer ( 127.0.0.1 : 19720) : ${message.toString()}`
        );
      });
    });

    this.webSocketServer.on('close', () => {
      Logger.info(
        `WebSocket Server closing on ${this.config.ip}:${this.config.port}`
      );
    });
  }

  initFeed() {
    this.webSocketFeed = new WebSocket(this.config.url_block_feed, {
      followRedirects: false,
    });

    this.webSocketFeed.on('error', (error) => {
      Logger.warn(error);
    });

    this.webSocketFeed.on('close', () => {
      this.webSocketFeed = {} as WebSocket;
      setTimeout(() => {
        this.initFeed();
      }, 1000);
    });

    this.webSocketFeed.on('message', async (message: Buffer) => {
      let block: any = {};
      try {
        block = JSON.parse(message.toString());
        //@FIXME logging
        Logger.trace('Feeder part: ' + JSON.stringify(block.tx[0].commands[0]));

        // business protocol
        const orderBook = await this.feeder.processState(block);

        // if it qualifies, forward the relevant object
        this.webSocketServer.clients.forEach((ws) => {
          // probably, here should be a stringified object instead of the binary message
          // probably, only to specific subscribers
          Logger.info(JSON.stringify(orderBook));
          ws.send(JSON.stringify(orderBook));
        });
      } catch (e) {
        return;
      }
    });
  }

  async shutdown() {
    await this.feeder.clear();
    await this.feeder.shutdown();
    return new Promise((resolve) => {
      this.webSocketServer.clients.forEach((ws) => {
        ws.terminate();
      });
      this.webSocketServer.close(resolve);
    });
  }
}
