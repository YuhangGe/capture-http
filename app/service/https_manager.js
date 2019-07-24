import EventEmitter from './event_emitter';
import find from 'lodash-es/find';
import {
  certsRoot,
  manager as settingManger
} from './setting';

const fs = require('fs');
const path = require('path');
const https = require('https');
const ffp = require('find-free-port');

class FreePortManager {
  constructor() {
    this._startPort = 10013;
    this._queue = [];
  }

  _schedule() {
    if (this._queue.length <= 0) {
      return;
    }
    const rp = this._queue[0];
    if (rp.state > 0) return;
    rp.state = 1;
    ffp(this._startPort, '127.0.0.1', (err, freePort) => {
      this._startPort = parseInt(freePort) + 1;
      const rp = this._queue.shift();
      if (err) rp.reject(err);
      else rp.resolve(freePort);
      rp.resolve = rp.reject = null;
      process.nextTick(() => this._schedule());
    });
  }

  get() {
    return new Promise((resolve, reject) => {
      const rp = {
        resolve,
        reject,
        state: 0
      };
      this._queue.push(rp);
      this._schedule();
    });
  }
}

const fpManager = new FreePortManager();

class Server {
  constructor(info, proxyServer, proxyPort) {
    this.info = info;
    this._server = null;
    this._certs = new Map();
    this.port = null;
    this._proxyServer = proxyServer;
    this._proxyPort = proxyPort;
  }

  getCert(domain) {
    let cert = this._certs.get(domain);
    if (!cert) {
      const name = domain.substring(2);
      const certificate = fs.readFileSync(path.join(certsRoot, name + '.cert.pem'), 'utf-8');
      const privateKey = fs.readFileSync(path.join(certsRoot, name + '.key.pem'), 'utf-8');
      cert = {
        certificate,
        privateKey
      };
      this._certs.set(domain, cert);
    }
    return cert;
  }

  async start() {
    const freePort = await fpManager.get();
    const cert = this.getCert(this.info.rootDomain);
    this.port = freePort;
    this._server = https.createServer({
      key: cert.privateKey,
      cert: cert.certificate
    });
    this._server.on('request', (req, res) => {
      this._proxyServer._handleRequest(req, res, {
        hostname: this.info.domain,
        port: this._proxyPort
      });
    });
    await new Promise(resolve => {
      this._server.listen(freePort, '127.0.0.1', () => {
        console.log(`Proxy ssl server for ${this.info.domain} listening at 127.0.0.1:${freePort}`);
        resolve();
      });
    });
  }

  destroy() {
    this._server && this._server.close();
    this._proxyServer = null;
  }
}

class HTTPSManager extends EventEmitter {
  constructor() {
    super();
    this._onlineServers = new Map();
    this._proxyServer = null;
  }

  registerProxyServer(proxyServer) {
    this._proxyServer = proxyServer;
  }

  destroy() {
    this._onlineServers.forEach(server => {
      server.destroy();
    });
  }

  getServer(hostname, port) {
    const hostInfo = find(settingManger.hosts, h => h.domain === hostname);
    if (!hostInfo || !hostInfo.enabled) {
      return Promise.resolve(null);
    }
    const key = hostInfo.domain + ':' + port;
    let info = this._onlineServers.get(key);
    if (!info) {
      const server = new Server(hostInfo, this._proxyServer, port);
      info = {
        s: server,
        p: server.start().then(() => {
          info.p = null;
        })
      };
      this._onlineServers.set(key, info);
    }
    return new Promise((resolve, reject) => {
      if (info.p) {
        info.p.then(() => {
          resolve(info.s);
        }, reject);
      } else {
        resolve(info.s);
      }
    });
  }
}

// singleton
const httpsManager = new HTTPSManager();
window.addEventListener('close', () => {
  httpsManager.destroy();
});
export default httpsManager;
