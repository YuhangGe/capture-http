const _util = require('./util');
const path = require('path');
const less = require('./css/less');
const html = require('./html/gen');
const rollup = require('./js/rollup');
const cwd = path.resolve(__dirname, '../');
const distRoot = path.join(cwd, 'dist');
const pkg = require('../package.json');
const electronPackager = require('electron-packager');

function pick(obj, ...props) {
  const newObj = {};
  props.forEach(p => {
    newObj[p] = obj[p];
  });
  return newObj;
}

async function build() {
  console.log('capture-http build tool running...');
  await _util.exec(`rm -rf ${path.join(cwd, 'dist/*')}`);
  await _util.exec(`rm -rf ${path.join(cwd, 'release/*')}`);
  await _util.mkdir(path.join(cwd, 'dist/js'), true);
  await _util.mkdir(path.join(cwd, 'dist/css'), true);
  await _util.mkdir(path.join(cwd, 'release'));
  const results = await Promise.all([
    less(),
    rollup()
  ]);
  await html(null, ...results);
  const newPkg = pick(
    pkg, 'name',
    'productName',
    'description',
    'repository',
    'keywords',
    'license'
  );
  newPkg.main = 'main.js';
  newPkg.scripts = { start: 'electron .' };
  newPkg.dependencies = pick(
    pkg.dependencies,
    'find-free-port',
    'ip',
    'highlight.js',
    'node-forge'
  );
  await _util.writeFile(path.join(distRoot, 'package.json'), JSON.stringify(newPkg, null, 2));
  console.log('Running npm install...');
  const result = await _util.exec('npm install --no-package-lock --registry=https://registry.npm.taobao.org', {
    cwd: distRoot
  });
  console.log(result);
  await _util.exec(`cp ${path.join(cwd, 'app/main.js')} ${path.join(distRoot, 'main.js')}`);
  await _util.exec(`cp ${path.join(cwd, 'assets/icons/128x128.png')} ${distRoot}/icon.png`);

  await electronPackager({
    dir: distRoot,
    icon: path.join(cwd, 'assets/icons/capture'),
    out: path.join(cwd, 'release'),
    overwrite: true
  });
  console.log('Build finish.');
}

module.exports = build;
