export default class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(eventName, handler) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }
    const arr = this._listeners.get(eventName);
    if (arr.indexOf(handler) < 0) {
      arr.push(handler);
    }
    return this;
  }

  off(eventName, handler) {
    if (!this._listeners.has(eventName)) return this;
    const arr = this._listeners.get(eventName);
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
    return this;
  }

  removeListener(eventName, handler) {
    return this.off(eventName, handler);
  }

  removeAllListeners(eventName) {
    if (!eventName) {
      this._listeners.clear();
    } else if (this._listeners.has(eventName)) {
      this._listeners.get(eventName).length = 0;
    }
    return this;
  }

  addListener(eventName, handler) {
    return this.on(eventName, handler);
  }

  emit(eventName, ...args) {
    if (!this._listeners.has(eventName)) return;
    this._listeners.get(eventName).forEach(handler => {
      handler(...args);
    });
  }
}
