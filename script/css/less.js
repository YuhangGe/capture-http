const less = require('less');
const _util = require('../util');
const path = require('path');
const LessPluginCleanCSS = require('less-plugin-clean-css');
const config = require('../config');
const appRoot = path.join(config.root, 'app');

async function _render(cnt) {
  const result = await new Promise(resolve => {
    less.render(cnt, {
      paths: [ path.join(appRoot, 'style') ],
      plugins: (!config.buildMode || config.noCompress) ? [] : [ new LessPluginCleanCSS({ advanced: true }) ],
      sourceMap: (!config.buildMode || config.noCompress) ? {
        sourceMapBasepath: appRoot,
        sourceMapURL: `${config.pkgName}.css.map`
      } : false
    }).then(resolve, resolve);
  });
  if (!result.css) throw new Error(result.message);
  return await _write(config.pkgName, result);
}

async function _write(outputName, result) {
  if (config.buildMode) {
    outputName += `.${config.buildHash}.min.css`;
  } else {
    outputName += '.css';
  }
  const dir = path.join(config.root, config.buildMode ? 'dist/css' : '.tmp/css');
  await _util.mkdir(dir, true);
  await _util.writeFile(path.join(dir, outputName), result.css);
  if ((!config.buildHash || config.noCompress) && result.map) {
    await _util.writeFile(path.join(dir, `${outputName}.map`), result.map);
  }
  console.log(`Generate CSS ${outputName.green}`);
  return outputName;
}

module.exports = async function compile() {
  const cnt = await _util.readFile(path.join(appRoot, 'style/index.less'), 'utf-8');
  const outputName = await _render(cnt);
  return `css/${outputName}`;
};