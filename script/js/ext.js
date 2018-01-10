const path = require('path');
const _util = require('../util');
const config = require('../config');

async function addExtensionIfNecessary(file, extensions) {
  try {
    const _st = await _util.stat(file);
    if (_st.isFile()) return file;
    if (_st.isDirectory()) {
      file = path.join(file, 'index');
    }
  } catch(ex) {
    // ignore
  }
  for(let i = 0; i < extensions.length; i++) {
    const _file = `${file}${extensions[i]}`;
    try {
      const _stat = await _util.stat(_file);
      if (_stat.isFile()) return _file;
    } catch(ex) {
      // ignore
    }
  }
  return file;
}

const KNOWN_EXT = /\.((js)|(jsx)|(css)|(html)|(less)|(sass))$/;

module.exports = function (options) {
  let extensions = options.extensions || ['.js'];
  if (!Array.isArray(extensions)) {
    extensions = [extensions];
  }
  return {
    name: 'extensions',
    resolveId (importee, importer) {
      if (KNOWN_EXT.test(importee)) {
        return null;
      }
      return new Promise(resolve => {
        if ( path.isAbsolute( importee ) ) {
          addExtensionIfNecessary(
            path.resolve( importee ),
            extensions
          ).then(resolve);
        } else if ( importer === undefined ) {
          addExtensionIfNecessary(
            path.resolve(config.root, importee),
            extensions
          ).then(resolve);
        } else if ( importee[0] !== '.' ) {
          resolve(null);
        } else {
          addExtensionIfNecessary(
            path.resolve(path.dirname(importer), importee),
            extensions
          ).then(resolve);
        }
      });
    }
  };
};
