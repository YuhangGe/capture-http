import EventEmitter from './event_emitter';
import { Record } from './record';
import pick from 'lodash-es/pick';

const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const fp = require('find-free-port');
const ip = require('ip');
const path = require('path');

const sslOptions = {
  key: fs.readFileSync(path.join(process.cwd(), 'cert/private/xiaoge.me.key.pem')),
  cert: fs.readFileSync(path.join(process.cwd(), 'cert/certs/xiaoge.me.cert.pem'))
};
class ProxyServer extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this._server = null;
    this._sslPort = null;
    this._sslServer = null;
    this._capturing = true;
    this.filter = {
      url: '',
      protocol: '',
      status: '',
      mime: '',
      method: ''
    };
    this._records = [ ];
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
    return new Promise((resolve, reject) => {
      if (this.port) return resolve();
      this._startSSLServer();      
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
  _startSSLServer() {
    return new Promise((resolve, reject) => {
      if (this._sslServer) return resolve();
      fp(10443, '127.0.0.1', (err, freePort) => {
        if (err) return reject(err);
        this._sslPort = freePort;
        this._sslServer = https.createServer(sslOptions);
        this._sslServer.on('request', this._handleSSLRequest.bind(this));
        this._sslServer.listen(this._sslPort, '127.0.0.1', () => {
          console.log(`Proxy ssl server listening at 127.0.0.1:${freePort}`);
          resolve();
        });
      });
    });
  }
  _handleSSLRequest(req, res) {
    this._handleRequest(req, res, true);
  }
  _proxy(cReq, cRes, isHttps, record = null) {
    console.log(cReq.url);
    const u = url.parse(cReq.url);
    const options = {
      hostname: isHttps ? 'zy.xiaoge.me' : u.hostname,
      port: isHttps ? 443 : (u.port || 80),
      path: u.path,
      method: cReq.method,
      headers: cReq.headers
    };
    if (record) {
      record.isHttps = isHttps;
      record.host = options.hostname;
      record.path = options.path;
    }
    const pReq = (isHttps ? https : http).request(options, pRes => {
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
  _shouldRecord(req, isHttps = false) {
    const {
      url,
      method,
      protocol
    } = this.filter;
    const shouldProtocol = isHttps ? 'https' : 'http';
    if (protocol && protocol !== 'all' && shouldProtocol !== protocol ) {
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
    console.log(status, mime, ct);
    
    switch(mime) {
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
  _handleRequest(cReq, cRes, isHttps = false) {
    if (!this._capturing) {
      return this._proxy(cReq, cRes, isHttps);
    }
    if (!this._shouldRecord(cReq, isHttps)) {
      return this._proxy(cReq, cRes, isHttps);
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
        this._records.push(record);
        this.emit('records-changed');
      } else {
        record.destroy();
      }
    };
    if (status && status !== 'all' || mime && mime !== 'all') {
      record.on('state-changed', onRSC);
    } else {
      this._records.push(record);
      this.emit('records-changed');
    }
    return this._proxy(cReq, cRes, isHttps, record);
  }
  
  _handleConnect(cReq, cSock) {
    // const u = url.parse('http://' + cReq.url);
    // console.log('proxy c', cReq.url);
    const pSock = net.connect(this._sslPort, '127.0.0.1', function () {
      cSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      pSock.pipe(cSock);
    }).on('error', err => {
      console.error(err);
      cSock.end();
      pSock.end();
    });
    cSock.pipe(pSock);
    cSock.on('error', err => {
      console.error(err);
      pSock.end();
      cSock.end();
    });
  }
  
}

// singleton
export default new ProxyServer();
