import EventEmitter from './event_emitter';
import { Record } from './record';
import pick from 'lodash-es/pick';

const http = require('http');
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
  _proxy(cReq, cRes, record = null) {
    const u = url.parse(cReq.url);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.path,
      method: cReq.method,
      headers: cReq.headers
    };
    const pReq = http.request(options, pRes => {
      cRes.writeHead(pRes.statusCode, pRes.headers);
      if (record) {
        Object.assign(record.response, pick(pRes, 'statusCode', 'headers'));
        record.pipeResponse(pRes, cRes);
      } else {
        pRes.pipe(cRes);
      }
      pRes.on('error', err => {
        if (record) {
          record.error = err;          
        }
        cRes.end();
      });
    }).on('error', err => {
      if (record) {
        record.error = err;          
      }
      cRes.end();
    });
    if (record) {
      record.pipeRequest(cReq, pReq);
    } else {
      cReq.pipe(pReq);
    }
    cReq.on('error', err => {
      if (record) {
        record.error = err;          
      }
      cRes.end();
    });
  }
  _shouldRecord(req) {
    const {
      url,
      method
    } = this.filter;
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
  _handleRequest(cReq, cRes) {
    if (!this._capturing) {
      return this._proxy(cReq, cRes);
    }
    if (!this._shouldRecord(cReq)) {
      return this._proxy(cReq, cRes);
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
    return this._proxy(cReq, cRes, record);
  }
  
  _handleConnect(cReq, cSock) {
    const u = url.parse('http://' + cReq.url);
    const pSock = net.connect(u.port, u.hostname, function () {
      cSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      pSock.pipe(cSock);
    }).on('error', err => {
      console.error(err);
      cSock.end();
    });
  
    cSock.pipe(pSock);
  }
  
}

// singleton
export default new ProxyServer();
