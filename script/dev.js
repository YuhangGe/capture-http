const _util = require('./util');
const path = require('path');
const watcher = require('chokidar');
const config = require('./config');
const less = require('./css/less');
const html = require('./html/gen');
const rollup = require('./js/rollup');
const createReloadServer = require('./serve/server');
const electron = require('electron');
const spawn = require('child_process').spawn;

const cacheFiles = [];

async function dev() {
  console.log('capture-http develop tool running...');
  await _util.mkdir(path.join(config.root, '.tmp/js'), true);
  await _util.mkdir(path.join(config.root, '.tmp/css'), true);
  
  const server = await createReloadServer();
  const results = await Promise.all([
    less(),
    rollup()
  ]);
  cacheFiles.push(...results);
  await html(server, ...results);
  
  const electronApp = spawn(electron, ['.'], {stdio: 'inherit'});
  electronApp.on('close', code => {
    process.exit(code);
  });
  watch(path.join(config.root, 'app'), onSrcFileChange);
  watch(path.join(config.root, '.tmp'), onTmpFileChange);

  let changeBusy = false;

  function onSrcFileChange(file) {
    if (changeBusy) return;
    (async function () {
      changeBusy = true;
      const ext = path.extname(file);
      if ('.htm' === ext) {
        await html(cacheFiles[0], cacheFiles[1], cacheFiles[2], server.port);
      } else if ('.less' === ext) {
        await less(file);
      } else if (['.js', '.jsx', '.html'].indexOf(ext) >= 0) {
        await rollup(file);
      }
      changeBusy = false;
    })().catch(err => {
      console.log(err);
      changeBusy = false;
    });
  }

  function onTmpFileChange(file) {
    if (!/\.(js|css|html)$/.test(file)) return;
    server && server.reload();
  }

  function watch(dir, handler) {
    // console.log('Watching dir', path.relative(config.root, dir).green, 'for changes...');
    watcher.watch(dir, { ignoreInitial: true })
      .on('add', handler)
      .on('change', handler)
      .on('unlink', handler);
  }

}

module.exports = dev;
