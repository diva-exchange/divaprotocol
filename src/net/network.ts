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

import { Logger } from '../logger';
import { Auth } from './message/auth';
import { Challenge } from './message/challenge';
import { Message } from './message/message';
import { nanoid } from 'nanoid';
import { SocksProxyAgent } from 'socks-proxy-agent';
import WebSocket from 'ws';
import { Validation } from './validation';
import { Util } from '../transactions/util';
import { Server } from './server';
import { Sync } from './message/sync';
import Timeout = NodeJS.Timeout;

const WS_CLIENT_OPTIONS = {
  compress: true,
  binary: true,
};

export type NetworkPeer = {
  host: string;
  port: number;
  stake: number;
};

interface Peer {
  address: string;
  alive: number;
  stale: number;
  ws: WebSocket;
}

export class Network {
  private readonly server: Server;
  private readonly publicKey: string;
  private readonly mapPeer: Map<string, NetworkPeer> = new Map();
  private arrayPeerNetwork: Array<string> = [];
  private arrayBroadcast: Array<string> = [];

  private peersIn: { [publicKey: string]: Peer } = {};
  private peersOut: { [publicKey: string]: Peer } = {};

  private readonly _onMessage: Function | false;
  private aGossip: Array<string> = [];

  private timeoutMorph: Timeout = {} as Timeout;
  private timeoutRefresh: Timeout = {} as Timeout;
  private timeoutPing: Timeout = {} as Timeout;
  private timeoutClean: Timeout = {} as Timeout;

  static make(server: Server, onMessage: Function) {
    return new Network(server, onMessage);
  }

  private constructor(server: Server, onMessage: Function) {
    this.server = server;
    this._onMessage = onMessage || false;

    this.publicKey = this.server.getWallet().getPublicKey();
    Logger.info(`Network, public key: ${this.publicKey}`);

    Validation.init();

    // incoming connection
    this.server.getWebSocketServer().on('connection', (ws, request) => {
      const publicKey = request.headers['diva-identity']?.toString() || '';

      if (publicKey && publicKey !== this.publicKey && this.mapPeer.has(publicKey)) {
        this.auth(ws, publicKey);
      } else {
        Logger.warn('Connection credentials missing (diva-identity)');
        ws.close(4003, 'Auth Credentials missing');
      }
    });

    this.server.getWebSocketServer().on('error', (error: Error) => {
      Logger.warn('WebsocketServer error');
      Logger.trace(error);
    });

    const startDelayMs = this.server.config.i2p_socks_proxy_host
      ? this.server.config.network_morph_interval_ms
      : this.server.config.network_refresh_interval_ms;

    Logger.info(`Starting P2P network in about ${Math.floor(startDelayMs / 1000)} secs`);

    // initial timeout
    setTimeout(() => {
      Logger.info('Starting P2P network');
      this.timeoutMorph = setTimeout(() => this.morphPeerNetwork(), 1);
      this.timeoutRefresh = setTimeout(() => this.refresh(), this.server.config.network_refresh_interval_ms);
      this.timeoutPing = setTimeout(() => this.ping(), this.server.config.network_ping_interval_ms);
      this.timeoutClean = setTimeout(() => this.clean(), this.server.config.network_clean_interval_ms);
    }, startDelayMs);
  }

  shutdown() {
    clearTimeout(this.timeoutMorph);
    clearTimeout(this.timeoutRefresh);
    clearTimeout(this.timeoutPing);
    clearTimeout(this.timeoutClean);

    if (this.server.getWebSocketServer()) {
      Object.values(this.peersOut)
        .concat(Object.values(this.peersIn))
        .forEach((peer) => {
          peer.ws.close(1000, 'Bye');
        });
    }
  }

  addPeer(publicKey: string, peer: NetworkPeer): Network {
    if (!this.mapPeer.has(publicKey)) {
      this.mapPeer.set(publicKey, peer);
    }
    return this;
  }

  removePeer(publicKey: string): Network {
    if (this.mapPeer.has(publicKey)) {
      this.peersIn[publicKey] && this.peersIn[publicKey].ws.close(1000, 'Bye');
      this.peersOut[publicKey] && this.peersOut[publicKey].ws.close(1000, 'Bye');

      this.mapPeer.delete(publicKey);
    }
    return this;
  }

  resetNetwork() {
    [...this.mapPeer.keys()].map((publicKey) => {
      this.removePeer(publicKey);
    });
  }

  getQuorum(): number {
    let stake = 0;
    this.mapPeer.forEach((p: NetworkPeer) => {
      stake = stake + p.stake;
    });

    if (stake <= 0) {
      throw new Error('Invalid network quorum');
    }

    return (2 * stake) / 3; // PBFT, PoS
  }

  getStake(publicKey: string): number {
    return (this.mapPeer.get(publicKey) as NetworkPeer).stake || 0;
  }

  peers() {
    const peers: { net: Array<string>; in: Array<object>; out: Array<object> } = {
      net: this.arrayPeerNetwork,
      in: [],
      out: [],
    };
    Object.keys(this.peersIn).forEach((p) => {
      peers.in.push({
        publicKey: p,
        address: this.peersIn[p].address,
        stale: this.peersIn[p].stale,
        alive: this.peersIn[p].alive,
      });
    });
    Object.keys(this.peersOut).forEach((p) => {
      peers.out.push({
        publicKey: p,
        address: this.peersOut[p].address,
        stale: this.peersOut[p].stale,
        alive: this.peersOut[p].alive,
      });
    });
    return peers;
  }

  network(): Array<{ publicKey: string; api: string; stake: number }> {
    return [...this.mapPeer].map((v) => {
      return { publicKey: v[0], api: v[1].host + ':' + v[1].port, stake: v[1].stake };
    });
  }

  hasNetworkPeer(publicKey: string): boolean {
    return this.mapPeer.has(publicKey);
  }

  hasNetworkAddress(address: string): boolean {
    if (address.indexOf(':') > 0) {
      for (const v of [...this.mapPeer]) {
        if (v[1].host + ':' + v[1].port === address) {
          return true;
        }
      }
    }
    return false;
  }

  gossip(): Array<string> {
    return this.aGossip;
  }

  /**
   * Prevent any further gossiping of a specific message
   *
   * @param {string} ident - Message identifier
   */
  stopGossip(ident: string) {
    for (const _pk of this.arrayBroadcast) {
      this.aGossip.push(_pk + ident);
    }
  }

  /**
   * Reset the gossiping map
   */
  resetGossip() {
    this.aGossip = [];
  }

  /**
   * Process an incoming message
   *
   * @param {Buffer|string} message - Incoming message
   * @param {string} publicKeyPeer - Sender of the message
   */
  processMessage(message: Buffer | string, publicKeyPeer: string = '') {
    const m = new Message(message);
    const ident = m.ident();
    this.server.config.network_verbose_logging &&
      Logger.trace(`Network.processMessage from ${publicKeyPeer}: ${JSON.stringify(m.getMessage())}`);

    // stateless validation
    if (!Validation.validateMessage(m)) {
      return this.stopGossip(ident);
    }

    // process message handler callback
    this._onMessage && this._onMessage(m.type(), message);

    // broadcasting / gossip
    if (m.isBroadcast()) {
      // populate Gossiping map
      for (const _pk of m.trail()) {
        this.aGossip.includes(_pk + ident) || this.aGossip.push(_pk + ident);
      }

      const aBroadcast = this.arrayBroadcast.filter(
        (_pk) => !this.aGossip.includes(_pk + ident) && this.aGossip.push(_pk + ident)
      );

      if (aBroadcast.length) {
        // update message trail
        m.updateTrail(aBroadcast.concat([this.publicKey, m.origin(), publicKeyPeer]));

        // broadcast the message
        for (const _pk of aBroadcast) {
          try {
            if (this.peersOut[_pk] && this.peersOut[_pk].ws.readyState === 1) {
              Network.send(this.peersOut[_pk].ws, m.pack());
            } else if (this.peersIn[_pk] && this.peersIn[_pk].ws.readyState === 1) {
              Network.send(this.peersIn[_pk].ws, m.pack());
            } else {
              Logger.warn('processMessage() - broadcast: Websocket destination not available');
            }
          } catch (error) {
            Logger.warn('processMessage() - broadcast: Websocket Error');
            Logger.trace(JSON.stringify(error));
          }
        }
      }
    }
  }

  private auth(ws: WebSocket, publicKeyPeer: string) {
    if (this.peersIn[publicKeyPeer]) {
      this.peersIn[publicKeyPeer].ws.close(4005, 'Rebuilding');
      delete this.peersIn[publicKeyPeer];
    }

    const timeout = setTimeout(() => {
      ws.close(4005, 'Auth Timeout');
    }, this.server.config.network_auth_timeout_ms);

    const challenge = nanoid(26);
    Network.send(ws, new Challenge().create(challenge).pack());

    ws.once('message', (message: Buffer) => {
      clearTimeout(timeout);

      const peer = this.mapPeer.get(publicKeyPeer) || ({} as NetworkPeer);
      const mA = new Auth(message);
      if (!peer.host || !Validation.validateMessage(mA) || !mA.isValid(challenge, publicKeyPeer)) {
        return ws.close(4003, 'Auth Failed');
      }

      this.peersIn[publicKeyPeer] = {
        address: 'ws://' + peer.host + ':' + peer.port,
        alive: Date.now(),
        stale: 0,
        ws: ws,
      };
      this.arrayBroadcast = [...new Set(Object.keys(this.peersOut).concat(Object.keys(this.peersIn)))];

      ws.on('error', () => {
        ws.close();
      });
      ws.on('close', () => {
        delete this.peersIn[publicKeyPeer];
        this.arrayBroadcast = [...new Set(Object.keys(this.peersOut).concat(Object.keys(this.peersIn)))];
      });
      ws.on('message', (message: Buffer) => {
        if (this.peersIn[publicKeyPeer]) {
          this.peersIn[publicKeyPeer].alive = Date.now();
          this.processMessage(message, publicKeyPeer);
        }
      });
      ws.on('ping', async (data) => {
        if (this.peersIn[publicKeyPeer]) {
          if (Number(data.toString()) < this.server.getBlockchain().getHeight()) {
            this.peersIn[publicKeyPeer].stale++;
            if (this.peersIn[publicKeyPeer].stale > this.server.config.network_stale_threshold) {
              this.peersIn[publicKeyPeer].stale = 0;
              const sync = await this.getSync(Number(data.toString()));
              Network.send(ws, sync.pack());
            }
          } else {
            this.peersIn[publicKeyPeer].stale = 0;
          }
        }
      });
      ws.on('pong', () => {
        this.peersIn[publicKeyPeer] && (this.peersIn[publicKeyPeer].alive = Date.now());
      });
    });
  }

  private refresh() {
    for (const publicKey of this.arrayPeerNetwork) {
      if (this.mapPeer.has(publicKey) && !this.peersOut[publicKey]) {
        this.connect(publicKey);
      }
    }

    Object.keys(this.peersOut)
      .filter((_pk) => {
        return !this.arrayPeerNetwork.includes(_pk);
      })
      .forEach((_pk) => {
        this.peersOut[_pk].ws.close(1000, 'Bye');
      });

    this.timeoutRefresh = setTimeout(() => this.refresh(), this.server.config.network_refresh_interval_ms);
  }

  private morphPeerNetwork() {
    if (this.mapPeer.size < 1) {
      this.arrayPeerNetwork = [];
      return;
    }

    let arrayPublicKey: Array<string> = Array.from(this.mapPeer.keys()).filter((_pk) => _pk !== this.publicKey);
    if (arrayPublicKey.length > this.server.config.network_size) {
      const _a = Util.shuffleArray(arrayPublicKey);
      arrayPublicKey = this.arrayPeerNetwork.slice(-1 * Math.ceil(this.server.config.network_size / 2));
      while (_a.length && arrayPublicKey.length < this.server.config.network_size) {
        const _pk = _a.pop();
        !arrayPublicKey.includes(_pk) && arrayPublicKey.push(_pk);
      }
    }
    this.arrayPeerNetwork = arrayPublicKey.slice();

    this.timeoutMorph = setTimeout(() => {
      this.morphPeerNetwork();
    }, this.server.config.network_morph_interval_ms);
  }

  private clean() {
    const t = Date.now() - this.server.config.network_clean_interval_ms * 2; // timeout
    Object.values(this.peersOut)
      .concat(Object.values(this.peersIn))
      .forEach((peer) => {
        peer.alive < t && peer.ws.close(4002, 'Timeout');
      });

    if (this.aGossip.length > this.server.config.network_gossip_drop_entries_max) {
      this.aGossip.splice(0, Math.floor(this.aGossip.length / 3));
    }

    this.timeoutClean = setTimeout(() => this.clean(), this.server.config.network_clean_interval_ms);
  }

  private connect(publicKeyPeer: string) {
    const peer = this.mapPeer.get(publicKeyPeer) || ({} as NetworkPeer);
    if (!peer.host) {
      return;
    }
    const address = 'ws://' + peer.host + ':' + peer.port;
    const options: WebSocket.ClientOptions = {
      followRedirects: false,
      perMessageDeflate: this.server.config.per_message_deflate,
      headers: {
        'diva-identity': this.publicKey,
      },
    };

    if (
      this.server.config.i2p_socks_proxy_host &&
      this.server.config.i2p_socks_proxy_port > 0 &&
      /\.i2p$/.test(peer.host)
    ) {
      options.agent = new SocksProxyAgent(
        `socks://${this.server.config.i2p_socks_proxy_host}:${this.server.config.i2p_socks_proxy_port}`
      );
    }

    const ws = new WebSocket(address, options);
    this.peersOut[publicKeyPeer] = {
      address: address,
      alive: Date.now(),
      stale: 0,
      ws: ws,
    };
    this.arrayBroadcast = [...new Set(Object.keys(this.peersOut).concat(Object.keys(this.peersIn)))];

    ws.on('close', () => {
      delete this.peersOut[publicKeyPeer];
      this.arrayBroadcast = [...new Set(Object.keys(this.peersOut).concat(Object.keys(this.peersIn)))];
    });
    ws.on('error', () => {
      ws.close();
    });
    ws.once('message', (message: Buffer) => {
      const mC = new Challenge(message);
      if (!Validation.validateMessage(mC) || !mC.isValid()) {
        return ws.close(4003, 'Challenge Failed');
      }
      const wallet = this.server.getWallet();
      Network.send(ws, new Auth().create(wallet.sign(mC.getChallenge())).pack());

      ws.on('message', (message: Buffer) => {
        if (this.peersOut[publicKeyPeer]) {
          this.peersOut[publicKeyPeer].alive = Date.now();
          this.processMessage(message, publicKeyPeer);
        }
      });
      ws.on('ping', async (data) => {
        if (this.peersOut[publicKeyPeer]) {
          if (Number(data.toString()) < this.server.getBlockchain().getHeight()) {
            this.peersOut[publicKeyPeer].stale++;
            if (this.peersOut[publicKeyPeer].stale > this.server.config.network_stale_threshold) {
              this.peersOut[publicKeyPeer].stale = 0;
              const sync = await this.getSync(Number(data.toString()));
              Network.send(ws, sync.pack());
            }
          } else {
            this.peersOut[publicKeyPeer].stale = 0;
          }
        }
      });
      ws.on('pong', () => {
        this.peersOut[publicKeyPeer] && (this.peersOut[publicKeyPeer].alive = Date.now());
      });
    });
  }

  private ping(): void {
    let t = this.server.config.network_ping_interval_ms;
    Util.shuffleArray(Object.values(this.peersOut).concat(Object.values(this.peersIn))).forEach((peer) => {
      setTimeout(() => {
        peer.ws.readyState === 1 && peer.ws.ping(this.server.getBlockchain().getHeight());
      }, t);
      t = t + 10;
    });

    this.timeoutPing = setTimeout(() => this.ping(), t);
  }

  private async getSync(height: number): Promise<Sync> {
    const arrayBlocks = await this.server
      .getBlockchain()
      .get(0, height + 1, height + this.server.config.network_sync_size);
    return new Sync().create(arrayBlocks);
  }

  private static send(ws: WebSocket, data: string) {
    ws.send(data, WS_CLIENT_OPTIONS);
  }
}
