import pick from 'lodash-es/pick';
import EventEmitter from './event_emitter';
function simpleUUID() {
  return Date.now().toString(32) + '-' + (Math.random() * 100000 | 0).toString(32);
}

export class Record extends EventEmitter {
  constructor(req) {
    super();
    this.id = simpleUUID();
    this.request = req ? pick(req, 'method', 'url', 'headers') : null;
    this.response = {};
    this._state = 'waiting';
    this._err = null;
    this.startAt = Date.now();
    this.duration = 0;
    this.path = null;
    this.host = null;
    this.isHttps = false;
  }

  destroy() {
    this.request = null;
    this.response = null;
    this.removeAllListeners();
  }

  get error() {
    return this._err;
  }

  set error(err) {
    this._err = err;
    this.state = 'error';
  }

  get state() {
    return this._state;
  }

  set state(v) {
    if (this._state === v) return;
    this._state = v;
    this.emit('state-changed', this._state);
  }

  _proxy(from, to) {
    return new Promise((resolve, reject) => {
      let body = Buffer.allocUnsafe(0);
      from.on('data', chunk => {
        body = Buffer.concat([body, chunk], body.length + chunk.length);
        to.write(chunk);
      });
      from.on('end', () => {
        to.end();
        resolve(body);
      });
      from.on('error', reject);
      to.on('error', reject);
    });
  }

  pipeRequest(cReq, pReq) {
    this.state = 'requesting';
    this._proxy(cReq, pReq).then(body => {
      this.request.body = body;
    }, err => {
      this.error = err.message;
      this.state = 'error';
    });
  }

  pipeResponse(pRes, cRes) {
    this.state = 'responsing';
    this._proxy(pRes, cRes).then(body => {
      this.response.body = body;
      this.duration = Date.now() - this.startAt;
      this.state = 'finish';
    }, err => {
      this.error = err.message;
      this.state = 'error';
    });
  }
}
