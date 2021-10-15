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
import { Logger } from '../util/logger';
import WebSocket, { Server as WebSocketServer } from 'ws';
import { Feeder } from '../protocol/feeder';
import { Processor } from '../protocol/processor';
import Buffer from 'buffer';
import { Validation } from './validation';
import { BlockStruct, Message } from '../protocol/struct';
import { Nostro } from '../orderbook/nostro';
import { SubscribeManager } from '../protocol/subscribe-manager';

export class Server {
  private readonly config: Config;
  private processor: Processor = {} as Processor;
  private feeder: Feeder = {} as Feeder;
  private readonly validation: Validation;
  private readonly webSocketServer: WebSocketServer;
  private webSocketFeed: WebSocket | undefined;
  private subscribeManager: SubscribeManager = {} as SubscribeManager;
  private orderBook: Nostro = {} as Nostro;

  public static async make(config: Config): Promise<Server> {
    const s = new Server(config);
    s.processor = await Processor.make(config);
    s.feeder = await Feeder.make(config);
    s.subscribeManager = await SubscribeManager.make();
    s.orderBook = await Nostro.make(config);
    return s;
  }

  private constructor(config: Config) {
    this.config = config;
    this.validation = Validation.make();

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
        if (!Validation.make().validate(message)) {
          //@FIXME logging
          Logger.trace(`Message validation failed: ${message.toString()}`);
          return;
        }

        //@FIXME logging
        Logger.trace(`WebSocketServer received: ${message.toString()}`);

        let msg: Message;
        try {
          msg = JSON.parse(message.toString());
          await this.processor.process(msg, ws);
        } catch (error: any) {
          //@FIXME logging
          Logger.trace(error);
          return;
        }
      });
    });

    this.webSocketServer.on('close', () => {
      Logger.info(
        `WebSocket Server closing on ${this.config.ip}:${this.config.port}`
      );
    });
  }

  public initFeed() {
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
      let block: BlockStruct;
      try {
        block = JSON.parse(message.toString());
      } catch (error: any) {
        //@FIXME logging
        Logger.trace(error);
        return;
      }

      block.tx.forEach((tx) => {
        tx.commands.forEach(async (c) => {
          if (c.command === 'data' && c.ns.match('^DivaExchange.')) {
            //@FIXME logging
            Logger.trace('WebSocketFeed received: ' + JSON.stringify(c));

            await this.feeder.process(block);
          }
        });
      });
    });
  }

  public async shutdown() {
    // await this.feeder.clear();
    // await this.feeder.shutdown();
    return new Promise((resolve) => {
      this.webSocketServer.clients.forEach((ws) => {
        this.subscribeManager.deleteSockets(ws);
        ws.terminate();
      });
      this.webSocketServer.close(resolve);
    });
  }
}
