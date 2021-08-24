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

import { Server } from './server';
import { Request, Response } from 'express';
import { ArrayCommand, TransactionStruct } from '../transactions/transaction';
import { Logger } from '../logger';

const MIN_LENGTH_API_TOKEN = 32;
export const NAME_HEADER_API_TOKEN = 'diva-api-token';

export class Api {
  private server: Server;
  //private readonly pathToken: string;
  private token: string = '';

  static make(server: Server) {
    return new Api(server);
  }

  private constructor(server: Server) {
    this.server = server;

    const config = this.server.config;
    //this.pathToken = path.join(config.path_keys, config.address.replace(/[^a-z0-9_-]+/gi, '-') + '.api-token');
    this.createToken();
    this.route();
  }

  private createToken() {
    const l = Math.floor((Math.random() * MIN_LENGTH_API_TOKEN) / 3) + MIN_LENGTH_API_TOKEN;
    // fs.writeFileSync(this.pathToken, nanoid(l), { mode: '0600' });
    // this.token = fs.readFileSync(this.pathToken).toString();
    // setTimeout(() => {
    //   this.createToken();
    // }, 1000 * 60 * (Math.floor(Math.random() * 5) + 3)); // between 3 and 8 minutes
  }

  private route() {
    this.server.app.get('/join/:address/:publicKey', (req: Request, res: Response) => {
      return res.status(200).end();
    });

    this.server.app.get('/challenge/:token', (req: Request, res: Response) => {
      return res.status(200).end();
    });

    this.server.app.get('/sync/:height', async (req: Request, res: Response) => {
      return res.status(200).end();
    });

    this.server.app.get('/peers', (req: Request, res: Response) => {
      //return res.json(this.server.getNetwork().peers());
      return res.status(200).end();
    });

    this.server.app.get('/network', (req: Request, res: Response) => {
      //return res.json(this.server.getNetwork().network());
      return res.status(200).end();
    });

    this.server.app.get('/gossip', (req: Request, res: Response) => {
      //return res.json(this.server.getNetwork().gossip());
      return res.status(200).end();
    });

    this.server.app.get('/state/:key?', async (req: Request, res: Response) => {
      return res.status(200).end();
    });

    this.server.app.get('/stack/transactions', (req: Request, res: Response) => {
      //return res.json(this.server.getTransactionPool().getStack());
      return res.status(200).end();
    });

    this.server.app.get('/pool/transactions', (req: Request, res: Response) => {
      //return res.json(this.server.getTransactionPool().get());
      return res.status(200).end();
    });

    this.server.app.get('/pool/votes', (req: Request, res: Response) => {
      return res.status(200).end();
    });

    this.server.app.get('/pool/commits', (req: Request, res: Response) => {
      return res.status(200).end();
    });

    this.server.app.get('/block/genesis', async (req: Request, res: Response) => {
      return res.status(200).end();
    });

    this.server.app.get('/block/latest', async (req: Request, res: Response) => {
      return res.status(200).end();
    });

    // this.server.app.get('/blocks', async (req: Request, res: Response) => {
    //   try {
    //     const blockchain = this.server.getBlockchain();
    //     return res.json(
    //       await blockchain.get(Number(req.query.limit || 0), Number(req.query.gte || 0), Number(req.query.lte || 0))
    //     );
    //   } catch (error) {
    //     this.server.config.network_verbose_logging && Logger.trace(error);
    //     return res.status(500).end();
    //   }
    // });
    //
    // this.server.app.get('/blocks/page/:page?', async (req: Request, res: Response) => {
    //   try {
    //     const blockchain = this.server.getBlockchain();
    //     return res.json(await blockchain.getPage(Number(req.params.page || 0), Number(req.query.size || 0)));
    //   } catch (error) {
    //     this.server.config.network_verbose_logging && Logger.trace(error);
    //     return res.status(500).end();
    //   }
    // });
    //
    // this.server.app.get('/transaction/:origin/:ident', async (req: Request, res: Response) => {
    //   try {
    //     const blockchain = this.server.getBlockchain();
    //     return res.json(await blockchain.getTransaction(req.params.origin, req.params.ident));
    //   } catch (error) {
    //     this.server.config.network_verbose_logging && Logger.trace(error);
    //     return res.status(404).end();
    //   }
    // });
    //
    // this.server.app.get('/debug/performance/:height', async (req: Request, res: Response) => {
    //   try {
    //     const blockchain = this.server.getBlockchain();
    //     return res.json(await blockchain.getPerformance(Number(req.params.height)));
    //   } catch (error) {
    //     this.server.config.network_verbose_logging && Logger.trace(error);
    //     return res.status(404).end();
    //   }
    // });
    //
    // this.server.app.put('/transaction/:ident?', async (req: Request, res: Response) => {
    //   if (req.headers[NAME_HEADER_API_TOKEN] === this.token) {
    //     const wallet = this.server.getWallet();
    //     const t: TransactionStruct = new Transaction(wallet, req.body as ArrayCommand, req.params.ident).get();
    //     if (this.server.stackTransaction(t)) {
    //       return res.json(t);
    //     }
    //   }
    //   return res.status(403).end();
    // });
  }
}
