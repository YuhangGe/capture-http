import EventEmitter from './event_emitter';
import { Record } from './record';
import pick from 'lodash-es/pick';
import {
  manager as settingManager
} from './setting';
import HTTPSManager from './https_manager';

const http = require('http');
const https = require('https');
const fs = require('fs');
const net = require('net');
const url = require('url');
const fp = require('find-free-port');
const ip = require('ip');

function isFileExist(filename) {
  try {
    const st = fs.statSync(filename);
    return st.isFile();
  } catch (ex) {
    return false;
  }
}
class ProxyServer extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this._server = null;
    this._capturing = false;
    this.filter = {
      domain: '',
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
    // setTimeout(() => {
    //   this.startCapture();
    // }, 500);
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
    const isHttps = !!httpsInfo;
    let options;
    if (isHttps) {
      options = {
        hostname: httpsInfo.hostname || cReq.headers.host,
        port: httpsInfo.port || '443',
        path: cReq.url,
        method: cReq.method,
        headers: cReq.headers
      };
    } else {
      const u = new url.URL(cReq.url);
      options = {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method: cReq.method,
        headers: cReq.headers
      };
    }

    // console.log('req p => ', options.hostname, options.path);
    if (record) {
      record.isHttps = isHttps;
      record.host = options.hostname;
      record.path = options.path;
    }
    const pReq = (isHttps ? https : http).request(options, pRes => {
      cRes.writeHead(pRes.statusCode, Object.assign({}, pRes.headers, {
        Connection: 'close' // try to disable keep-alive
      }));
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

  _proxyLocalFile(cRes, record, target) {
    // console.log('proxy local file', target.filename);
    let cnt = null;
    let code = 404;
    if (isFileExist(target.filename)) {
      try {
        cnt = fs.readFileSync(target.filename);
        code = 200;
        record.state = 'finish';
      } catch (ex) {
        console.error(ex);
        code = 500;
        record.state = 'error';
      }
    } else {
      record.state = 'finish';
    }
    cRes.writeHead(code, {
      Connection: 'close'
    });
    cRes.end(cnt);
    record.duration = Date.now() - record.startAt;
    record.response.statusCode = code;
  }

  _addRecord(r) {
    this._records.push(r);
    this.emit('records-changed');
  }

  _shouldRecord(req, isHttps = false) {
    const {
      domain,
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
    let rUrl = req.url || '';
    const dm = rUrl.match(/^http(?:s?):\/\/([^/]+)/);
    if (dm) {
      const rd = dm[1].split(':')[0];
      if (domain.trim() && rd.indexOf(domain.trim()) < 0) {
        return false;
      }
      rUrl = rUrl.substring(dm[0].length);
    }
    if (url.trim() && rUrl.indexOf(url.trim()) < 0) {
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

  _getUrlMapTarget(cReq, httpsInfo) {
    const urlMaps = settingManager.proxies;
    if (!urlMaps || urlMaps.length === 0) {
      return null;
    }
    let rUrl = cReq.url || '';
    if (!/^http(?:s?):\/\//.test(rUrl)) {
      if (httpsInfo) {
        rUrl = `https://${httpsInfo.hostname}${httpsInfo.port === '443' ? '' : `:${httpsInfo.port}`}${rUrl}`;
      } else {
        return null;
      }
    }
    const urlMap = urlMaps.find(um => um.url === rUrl);
    if (!urlMap) {
      return null;
    }
    if (urlMap.target.startsWith('file://')) {
      return {
        type: 'file',
        filename: urlMap.target.substring(7)
      };
    } else {
      throw new Error('not implement.');
    }
  }

  _handleRequest(cReq, cRes, httpsInfo) {
    if (!this._capturing) {
      return this._proxy(cReq, cRes, httpsInfo);
    }
    if (!this._shouldRecord(cReq, !!httpsInfo)) {
      return this._proxy(cReq, cRes, httpsInfo);
    }
    const record = new Record(cReq, cRes);

    const urlMapTarget = this._getUrlMapTarget(cReq, httpsInfo);
    if (urlMapTarget && urlMapTarget.type === 'file') {
      if (httpsInfo) {
        record.isHttps = true;
        record.host = httpsInfo.hostname;
        record.path = cReq.url;
      }
      this._addRecord(record);
      this._proxyLocalFile(cRes, record, urlMapTarget);
      return;
    }

    const {
      status,
      mime
    } = this.filter;
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
    /*
     * https 模式下，cReq.url 只包含 `hostname:port` 信息，
     * 其它信息全部在加密的数据包里。
     */
    const [hostname, port] = cReq.url.split(':');
    if (!this._capturing || (this.filter.domain.trim() && hostname.indexOf(this.filter.domain.trim()) < 0)) {
      this._pipeConnect(cSock, port || 443, hostname);
      return;
    }
    HTTPSManager.getServer(hostname, port || '443').then(server => {
      if (server) {
        this._pipeConnect(cSock, server.port, '127.0.0.1');
        return;
      }
      const pSock = this._pipeConnect(cSock, port, hostname);
      const r = new Record();
      r.host = hostname + (port.toString() === '443' ? '' : `:${port}`);
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
