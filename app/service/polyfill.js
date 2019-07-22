/* eslint no-extend-native:"off" */
Promise.prototype.finally = function(handler) {
  return this.then(handler, handler);
};
