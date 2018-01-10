const path = require('path');
const _util = require('../util');
const config = require('../config');
const tmpLibPath = path.join(config.root, '.tmp/.lib');
const UglifyJS = require('uglify-es');
const CleanCSS = require('clean-css');

async function getLibPkg(lib) {
  if (lib[0] === '/') lib = lib.substring(1);
  const file = path.join(config.root, 'node_modules', lib);
  if ((await _util.exists(file))) {
    let idx = lib.indexOf('/');
    if (lib[0] === '@') {
      idx = lib.indexOf('/', idx + 1);
    }
    const pkgFile = path.join(config.root, 'node_modules', lib.substring(0, idx), 'package.json');
    if (!(await _util.exists(pkgFile))) {
      throw new Error('package.json of lib ' + lib + ' not found');
    }
    return [file, require(pkgFile)];
  } else {
    throw new Error('lib ' + lib + ' not found.');
  }
}

async function handleLib(lib) {
  const src = Array.isArray(lib) ? lib[0] : lib;
  const [file, pkg] = await getLibPkg(src);
  if (!pkg.version) throw new Error('package.json has no version');
  const ext = src.endsWith('.js') ? '.js' : '.css';
  const bn = path.basename(src, ext);
  if (!config.buildMode) {
    return [`${bn}-${pkg.version}${ext}`, await _util.readFile(file, 'utf-8')];
  }
  let minFile;
  if (Array.isArray(lib)) {
    minFile = path.resolve(path.dirname(file), lib[1]);
    let _st;
    try {
      _st = await _util.stat(minFile);
    } catch(ex) {
      console.log(ex);
      throw new Error(minFile, 'not found.');
    }
    if (_st.isDirectory()) {
      minFile = path.join(minFile, path.basename(file, ext) + `.min${ext}`);
      if (!(await _util.exists(minFile))) {
        throw new Error(minFile, 'not found.');
      }
    } else if (!_st.isFile()) {
      throw new Error(minFile, 'not found');
    }
    if (config.noCompress) {
      minFile = file;
    }
  } else {
    minFile = path.join(path.dirname(file), `${bn}.min${ext}`);
    if (config.noCompress) {
      minFile = file;
    } else {
      if (!(await _util.exists(minFile))) {
        minFile = await minLib(file, bn, pkg.version, config, ext);
      }
    }
  }

  return [`${bn}-${pkg.version}.min${ext}`, await _util.readFile(minFile, 'utf-8')];

}

async function minLib(file, bn, version, config, ext) {
  const minFile = path.join(tmpLibPath, `${bn}-${version}.min${ext}`);
  if (await _util.exists(minFile)) {
    return minFile;
  }
  console.log(`${bn}-${version}.min${ext}`.yellow,  `not found, use ${ext === '.js' ? 'uglify-js' : 'clean-css'} to generate it.`);
  let result = '';
  if (ext === '.js')  {
    const source = await _util.readFile(file, 'utf-8');
    const r = UglifyJS.minify(source);
    if (r.error) {
      throw r.error;
    }
    result = r.code;
  } else {
    const source = await _util.readFile(file, 'utf-8');
    result = new CleanCSS().minify(source).styles;
  }
  if (result) {
    await _util.writeFile(minFile, result);
  }
  return minFile;
}

module.exports = {
  handleLib,
  minLib
};
