import EventEmitter from './event_emitter';
import { Record } from './record';
import pick from 'lodash-es/pick';
import HTTPSManager from './https_manager';
import settingManager from './setting_manager';
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const fp = require('find-free-port');
const ip = require('ip');
class ProxyServer extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this._server = null;
    this._capturing = false;
    this.filter = {
      url: '',
      protocol: '',
      status: '',
      mime: '',
      method: ''
    };
    this._records = [];
    this.certDownloadServer = {
      port: null,
      server: null
    };
  }

  clearRecords() {
    this._records.forEach(r => r.destroy());
    this._records.length = 0;
    this.emit('records-changed');
  }

  get isCapturing() {
    return this._capturing;
  }

  startCapture() {
    if (this._capturing) return;
    this._capturing = true;
    this.emit('capture-changed', this._capturing);
  }

  stopCapture() {
    if (!this._capturing) return;
    this._capturing = false;
    this.emit('capture-changed', this._capturing);
  }

  initialize() {
    return Promise.all([
      this.startProxyServer(),
      this.startCertDownloadServer()
    ]);
  }

  startProxyServer() {
    return new Promise((resolve, reject) => {
      if (this.port) return resolve();
      fp(1337, '0.0.0.0', (err, freePort) => {
        if (err) return reject(err);
        this.port = freePort;
        this._server = http.createServer();
        this._server
          .on('request', this._handleRequest.bind(this))
          .on('connect', this._handleConnect.bind(this))
          .listen(freePort, '0.0.0.0', () => {
            console.log(`Proxy server listening at ${ip.address()}:${freePort}`);
            resolve();
          });
      });
    });
  }

  startCertDownloadServer() {
    return new Promise((resolve, reject) => {
      if (this.certDownloadServer.port) return resolve();
      fp(8000, '0.0.0.0', (err, freePort) => {
        if (err) return reject(err);
        this.certDownloadServer.port = freePort;
        this.certDownloadServer.server = http.createServer();
        this.certDownloadServer.server
          .on('request', this._handleDownloadCertRequest.bind(this))
          .listen(freePort, '0.0.0.0', () => {
            console.log(`Cert download server listening at ${ip.address()}:${freePort}`);
            resolve();
          });
      });
    });
  }

  _handleDownloadCertRequest(req, res) {
    if (!settingManager.ca) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/x-x509-user-cert',
      'content-disposition': 'attachment; filename=capture_http_ca.cert.pem'
    });
    res.write(settingManager.ca.certificate);
    res.end();
  }

  _proxy(cReq, cRes, httpsInfo, record = null) {
    const u = new url.URL(cReq.url);
    const options = {
      hostname: httpsInfo ? httpsInfo.hostname : u.hostname,
      port: httpsInfo ? (httpsInfo.port || 443) : (u.port || 80),
      path: u.path,
      method: cReq.method,
      headers: cReq.headers
    };
    if (record) {
      record.isHttps = !!httpsInfo;
      record.host = options.hostname;
      record.path = options.path;
    }
    const pReq = (httpsInfo ? https : http).request(options, pRes => {
      cRes.writeHead(pRes.statusCode, pRes.headers);
      if (record) {
        Object.assign(record.response, pick(pRes, 'statusCode', 'headers'));
        record.pipeResponse(pRes, cRes);
      } else {
        pRes.pipe(cRes);
      }
      pRes.on('error', err => {
        console.error(err);
        if (record) {
          record.error = err;
        }
        cRes.end();
      });
    }).on('error', err => {
      console.error(err);
      if (record) {
        record.error = err;
      }
      cRes.writeHead(500);
      cRes.end();
    });
    if (record) {
      record.pipeRequest(cReq, pReq);
    } else {
      cReq.pipe(pReq);
    }
    cReq.on('error', err => {
      console.error(err);
      if (record) {
        record.error = err;
      }
      pReq.end();
      cRes.end();
    });
  }

  _addRecord(r) {
    this._records.push(r);
    this.emit('records-changed');
  }

  _shouldRecord(req, isHttps = false) {
    const {
      url,
      method,
      protocol
    } = this.filter;
    const shouldProtocol = isHttps ? 'https' : 'http';
    if (protocol && protocol !== 'all' && shouldProtocol !== protocol) {
      return false;
    }
    if (method && method !== 'all' && req.method !== method) {
      return false;
    }
    if (url.trim() && req.url.indexOf(url.trim()) < 0) {
      return false;
    }
    return true;
  }

  _shouldPushRecord(status, mime, record) {
    const res = record.response;
    if (!res) return false;
    if (status && (!res.statusCode || status !== res.statusCode.toString())) {
      return false;
    }
    if (!mime) return true;
    if (!res.headers || !res.headers['content-type']) {
      return false;
    }
    const ct = res.headers['content-type'];
    switch (mime) {
      case 'json':
        return /\b(json)\b/.test(ct);
      case 'image':
        return ct.startsWith('image/');
      case 'text':
        return ct.startsWith('text/') || /\b(json|xml|javascript)\b/.test(ct);
      default:
        return false;
    }
  }

  _handleRequest(cReq, cRes, httpsInfo = null) {
    if (!this._capturing) {
      return this._proxy(cReq, cRes, httpsInfo);
    }
    if (!this._shouldRecord(cReq, !!httpsInfo)) {
      return this._proxy(cReq, cRes, httpsInfo);
    }
    const {
      status,
      mime
    } = this.filter;
    const record = new Record(cReq, cRes);
    const onRSC = state => {
      if (state !== 'error' && state !== 'finish') return;
      record.off('state-changed', onRSC);
      if (state !== 'finish' || this._shouldPushRecord(status, mime, record)) {
        this._addRecord(record);
      } else {
        record.destroy();
      }
    };
    if ((status && status !== 'all') || (mime && mime !== 'all')) {
      record.on('state-changed', onRSC);
    } else {
      this._addRecord(record);
    }
    return this._proxy(cReq, cRes, httpsInfo, record);
  }

  _handleConnect(cReq, cSock) {
    const u = new url.URL('http://' + cReq.url);
    if (!this._capturing) {
      this._pipeConnect(cSock, u.port || 443, u.hostname);
      return;
    }
    // console.log('proxy c', cReq.url);
    HTTPSManager.getServer(u.hostname, u.port || '443').then(server => {
      const port = server ? server.port : u.port;
      const host = server ? '127.0.0.1' : u.hostname;
      const pSock = this._pipeConnect(cSock, port, host);
      if (server) return;
      const r = new Record();
      r.host = u.hostname + (u.port.toString() === '443' ? '' : `:${u.port}`);
      r.isHttps = true;
      this._addRecord(r);
      const onFinish = () => {
        r.duration = Date.now() - r.startAt;
        r.state = 'finish';
        pSock.removeListener('end', onFinish);
        pSock.removeListener('error', onFinish);
      };
      pSock.on('end', onFinish);
      pSock.on('error', onFinish);
    });
  }

  _pipeConnect(cSock, port, host) {
    const pSock = net.connect(port, host, function() {
      cSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      pSock.pipe(cSock);
    });
    cSock.pipe(pSock);
    const onErr = err => {
      console.error(err);
      cSock.end();
      pSock.end();
      pSock.removeListener('error', onErr);
      cSock.removeListener('error', onErr);
    };
    pSock.on('error', onErr);
    cSock.on('error', onErr);
    return pSock;
  }
}

// singleton
const ps = new ProxyServer();
HTTPSManager.registerProxyServer(ps);
export default ps;
