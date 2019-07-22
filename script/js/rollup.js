const path = require('path');
const uglify = require('uglify-es');
const _util = require('../util');
const rollup = require('rollup');
const { string } = require('rollup-plugin-string');
const alias = require('rollup-plugin-alias');
const buble = require('rollup-plugin-buble');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const config = require('../config');

const rollupConfig = {
  external: config.rollupExternal,
  input: path.join(config.root, 'app/index.jsx'),
  output: {
    file: path.join(config.root, '.tmp/js', config.pkgName + '.js'),
    format: 'iife',
    globals: config.rollupGlobals,
    sourcemap: !config.buildMode
  },
  cache: null,
  plugins: [
    buble({
      objectAssign: 'Object.assign',
      include: path.join(config.root, 'app/**/*.jsx')
    }),
    string({
      include: path.join(config.root, 'app/**/*.html')
    }),
    alias(config.rollupAlias),
    nodeResolve({
      mainFields: ['jsnext:main', 'module', 'main', 'browser']
    }),
    commonjs(),
    require('./ext')({
      extensions: ['.js', '.jsx']
    })
  ]
};

module.exports = async function compile() {
  console.log('Start rollup packing', (rollupConfig.cache ? 'with cache' : '') + '...');
  try {
    const bundle = await rollup.rollup(rollupConfig);
    rollupConfig.cache = bundle;
    await bundle.write(rollupConfig);
    console.log('Rollup finish, generate', (config.pkgName + '.js').green);
  } catch (ex) {
    console.log(`Rollup error: ${ex.message.red}`);
    console.log(ex);
  }
  if (!config.buildMode) {
    return 'js/' + config.pkgName + '.js';
  }

  await _util.mkdir(path.join(config.root, 'dist', 'js'));
  let gCode = await _util.readFile(rollupConfig.file, 'utf-8');
  if (!config.noCompress) {
    console.log('Start uglify compressing...');
    const result = uglify.minify(gCode);
    if (result.error) {
      console.log('Uglify error:'.red);
      console.log(result.error);
    } else {
      gCode = result.code;
      console.log('Uglify finish.');
    }
  }
  const outFile = `${config.pkgName}.${config.buildHash}.min.js`;
  await _util.writeFile(path.join(config.root, 'dist', 'js', outFile), gCode);
  console.log('Generate JS', outFile.green);
  return 'js/' + outFile;
};
