#!/usr/bin/env node
require('colors');
if (process.env.hasOwnProperty('NO_COLOR')) {
  process.env.TERM = 'dumb';
}
const map = {
  dev: 'dev.js',
  build: 'build.js',
  less: 'css/less.js',
  rollup: 'js/rollup.js',
  html: 'html/gen.js'
};

function _exit(err) {
  if (err) console.error(err);
  process.exit(err ? -1 : 0);
}
process.on('uncaughtException', _exit);

const cmd = process.argv[2];
if (!map.hasOwnProperty(cmd)) {
  console.error('Unknown command.');
  process.exit(-1);
}

process.env.BUILD_MODE = cmd === 'build' ? 'true' : 'false';

try {
  require(`./${map[cmd]}`)().catch(_exit);
} catch (ex) {
  _exit(ex);
}
