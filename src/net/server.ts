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
import createError from 'http-errors';
import express from 'express';
import { Express, NextFunction, Request, Response } from 'express';
import http from 'http';
import WebSocket from 'ws';
import compression from 'compression';
import { Api } from './api';

export class Server {
  public readonly config: Config;
  public readonly app: Express;

  private readonly httpServer: http.Server;
  private readonly webSocketServer: WebSocket.Server;

  constructor(config: Config) {
    this.config = config;
    Logger.info(`divaprotocol ${this.config.VERSION} instantiating...`);

    // express application
    this.app = express();
    // hide express
    this.app.set('x-powered-by', false);

    // compression
    this.app.use(compression());

    // json
    this.app.use(express.json());

    // catch unavailable favicon.ico
    this.app.get('/favicon.ico', (req: Request, res: Response) => {
      res.sendStatus(204);
    });

    // init API
    Api.make(this);
    Logger.info('Api initialized');

    // catch 404 and forward to error handler
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      next(createError(404));
    });

    // error handler
    this.app.use(Server.error);

    // Web Server
    this.httpServer = http.createServer(this.app);
    this.httpServer.on('listening', () => {
      Logger.info(`HttpServer listening on ${this.config.ip}:${this.config.port}`);
    });
    this.httpServer.on('close', () => {
      Logger.info(`HttpServer closing on ${this.config.ip}:${this.config.port}`);
    });

    this.webSocketServer = new WebSocket.Server({
      server: this.httpServer,
      clientTracking: false,
      perMessageDeflate: this.config.per_message_deflate,
    });
    this.webSocketServer.on('connection', (ws: WebSocket) => {
      ws.on('error', (error: Error) => {
        //@FIXME logging
        Logger.trace(error);
        ws.terminate();
      });
    });
    this.webSocketServer.on('close', () => {
      Logger.info('WebSocketServer closing');
    });
  }

  async start(): Promise<Server> {

    await this.httpServer.listen(this.config.port, this.config.ip);

    return this;
  }

  async shutdown(): Promise<void> {

    if (this.webSocketServer) {
      await new Promise((resolve) => {
        this.webSocketServer.close(resolve);
      });
    }
    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(resolve);
      });
    }
  }

  getWebSocketServer(): WebSocket.Server {
    return this.webSocketServer;
  }

  private static error(err: any, req: Request, res: Response, next: NextFunction) {
    res.status(err.status || 500);

    res.json({
      path: req.path,
      status: err.status || 500,
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err : {},
    });

    next();
  }
}
