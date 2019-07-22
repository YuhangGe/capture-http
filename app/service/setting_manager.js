import EventEmitter from './event_emitter';
import {
  generateCA,
  generateDomainCert
} from './cert';
import HTTPSManager from './https_manager';

const path = require('path');
const fs = require('fs');
const isDevMode = process.env.NODE_ENV === 'development';
const electron = require('electron');
const dataRoot = isDevMode ? path.join(process.cwd(), 'data') : (electron.app || electron.remote.app).getPath('userData');
const certsRoot = path.join(dataRoot, 'certs');

function stat(fileOrDir) {
  try {
    return fs.statSync(fileOrDir);
  } catch (ex) {
    return null;
  }
}

function exist(fileOrDir) {
  try {
    fs.accessSync(fileOrDir);
    return true;
  } catch (ex) {
    return false;
  }
}

function mkdir(dir) {
  try {
    fs.accessSync(dir);
  } catch (ex) {
    fs.mkdirSync(dir);
  }
}

if (!exist(dataRoot)) mkdir(dataRoot);
mkdir(certsRoot);

console.log(dataRoot);

class SettingManager extends EventEmitter {
  constructor() {
    super();
    this._ca = null;
    this._hosts = null;
    this._proxies = null;
  }

  get ca() {
    if (!this._ca) {
      const certFile = path.join(dataRoot, 'ca.cert.pem');
      const keyFile = path.join(dataRoot, 'ca.key.pem');
      const certSt = stat(certFile);
      const keySt = stat(keyFile);
      if (!certSt || !keySt) return null;
      this._ca = {
        mtime: certSt.mtime,
        certificate: fs.readFileSync(certFile, 'utf-8'),
        privateKey: fs.readFileSync(keyFile, 'utf-8')
      };
    }
    return this._ca;
  }

  _writeHosts() {
    fs.writeFileSync(
      path.join(dataRoot, 'hosts.json'),
      JSON.stringify(this._hosts)
    );
    return this._hosts;
  }

  get hosts() {
    if (this._hosts) return this._hosts;
    const file = path.join(dataRoot, 'hosts.json');
    const _nh = () => {
      this._hosts = [];
      return this._writeHosts();
    };
    if (!exist(file)) return _nh();
    try {
      this._hosts = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!Array.isArray(this._hosts)) return _nh();
      else return this._hosts;
    } catch (ex) {
      console.error(ex);
      return _nh();
    }
  }

  addHost(host) {
    try {
      const pem = generateDomainCert(host.domain, this._ca);
      const name = host.domain.substring(2);
      fs.writeFileSync(path.join(certsRoot, name + '.cert.pem'), pem.certificate);
      fs.writeFileSync(path.join(certsRoot, name + '.key.pem'), pem.privateKey);
      fs.writeFileSync(path.join(certsRoot, name + '.key.pub.pem'), pem.publicKey);
      host.privateKey = pem.privateKey;
      host.publicKey = pem.publicKey;
      host.certificate = pem.certificate;
    } catch (ex) {
      console.error(ex);
      return false;
    }
    this._hosts.push(host);
    this._writeHosts();
    return true;
  }

  rmHost(host) {
    const idx = this._hosts.indexOf(host);
    idx >= 0 && this._hosts.splice(idx, 1);
    try {
      const name = host.domain.substring(2);
      fs.unlinkSync(path.join(certsRoot, name + '.cert.pem'));
      fs.unlinkSync(path.join(certsRoot, name + '.key.pem'));
      fs.unlinkSync(path.join(certsRoot, name + '.key.pub.pem'));
    } catch (ex) {
      console.error(ex);
    }
    this._writeHosts();
  }

  enableHost(host) {
    host.enabled = true;
    this._writeHosts();
  }

  disableHost(host) {
    host.enabled = false;
    this._writeHosts();
  }

  addProxy(proxy) {
    this._proxies.push(proxy);
    this._writeProxies();
    return true;
  }

  rmProxy(proxy) {
    const idx = this._proxies.indexOf(proxy);
    idx >= 0 && this._proxies.splice(idx, 1);
    this._writeProxies();
  }

  enableProxy(proxy) {
    proxy.enabled = true;
    this._writeProxies();
  }

  disableProxy(proxy) {
    proxy.enabled = false;
    this._writeProxies();
  }

  get proxies() {
    if (this._proxies) return this._proxies;
    const file = path.join(dataRoot, 'proxies.json');
    const _nh = () => {
      this._proxies = [];
      return this._writeProxies();
    };
    if (!exist(file)) return _nh();
    try {
      this._proxies = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!Array.isArray(this._proxies)) return _nh();
      else return this._proxies;
    } catch (ex) {
      console.error(ex);
      return _nh();
    }
  }

  _writeProxies() {
    fs.writeFileSync(
      path.join(dataRoot, 'proxies.json'),
      JSON.stringify(this._proxies)
    );
    return this._proxies;
  }

  generateCA(attrs) {
    return new Promise((resolve, reject) => {
      try {
        const pem = generateCA(attrs);
        fs.writeFileSync(path.join(dataRoot, 'ca.cert.pem'), pem.certificate);
        fs.writeFileSync(path.join(dataRoot, 'ca.key.pem'), pem.privateKey);
        fs.writeFileSync(path.join(dataRoot, 'ca.key.pub.pem'), pem.publicKey);
        this._ca = {
          mtime: new Date(),
          certificate: pem.certificate,
          privateKey: pem.privateKey
        };
        resolve(this._ca);
      } catch (ex) {
        console.error(ex);
        reject(ex);
      }
    });
  }
}

// singleton
const sm = new SettingManager();
HTTPSManager.registerSettingManager(sm);

export default sm;
