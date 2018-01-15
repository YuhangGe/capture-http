import EventEmitter from './event_emitter';
import find from 'lodash-es/find';

const https = require('https');
const ffp = require('find-free-port');

class Server {
  constructor(info, opts) {
    this.info = info;
    this._server = null;
    this.port = null;
    this._opts = opts;
  }
  _handleRequest(req, res) {
    this._opts.ps._handleRequest(req, res, {
      hostname: this._opts.hostname,
      port: this._opts.port
    });
  }
  start() {
    return new Promise((resolve, reject) => {
      ffp(10443, '127.0.0.1', (err, freePort) => {
        if (err) return reject(err);
        this.port = freePort;
        this._server = https.createServer({
          key: this.info.privateKey,
          cert: this.info.certificate
        });
        this._server.on('request', this._handleRequest.bind(this));
        this._server.listen(freePort, '127.0.0.1', () => {
          console.log(`Proxy ssl server for ${this.info.domain} listening at 127.0.0.1:${freePort}`);
          resolve();
        });
      });
    });
  }
  destroy() {
    this._server && this._server.close();
    this._ps = null;
  }
}

class HTTPSManager extends EventEmitter {
  constructor() {
    super();
    this._onlineServers = new Map();
    this._ps = null;
    this._sm = null;
  }
  registerProxyServer(ps) {
    this._ps = ps;
  }
  registerSettingManager(sm) {
    this._sm = sm;
  }
  async getServer(hostname, port) {
    const m = hostname.match(/[^.]+\.[^.]+$/);
    if (!m) {
      console.error('hostname not validate', hostname);
      return null;
    }
    const hostInfo = find(this._sm.hosts, h => h.domain === `*.${m[0]}`);
    if (!hostInfo || !hostInfo.enabled) {
      return null;
    }
    const key = hostname + ':' + port;
    if (!this._onlineServers.has(key)) {
      const server = new Server(hostInfo, {
        ps: this._ps,
        hostname,
        port
      });
      await server.start();
      this._onlineServers.set(key, server);
    }
    return this._onlineServers.get(key);
  }
}

// singleton
export default new HTTPSManager();
