const path = require('path');
const pEnv = process.env;
const env = {};

for(const k in pEnv) {
  if (k.startsWith('ENV_')) {
    let v = pEnv[k];
    if (/^\d+$/.test(v)) v = Number(v);
    env[k.substring(4)] = v;
  }
}

module.exports = {
  pkgName: 'caputre-http',
  buildMode: pEnv.BUILD_MODE === 'true',
  root: path.resolve(__dirname, '..'),
  env,
  noColor: pEnv.hasOwnProperty('NO_COLOR'),
  noCompress: pEnv.hasOwnProperty('NO_COMPRESS'),
  /**
   * 以下指定了依赖的所有第三方库。
   *   统一采用 npm 库，如果某个库没有发布到 npm，则自己 fork 然后发布。
   *   默认 min 版本和原始版本在同一个目录下，当不在同一个目录下时，
   *   通过数组的第二个参数指定相对路径。
   *   比如 moment 库的 min 版本在 moment/min/moment.min.js
   */
  libs: [
    ['moment/moment.js', './min'],
    ['react/umd/react.development.js', './react.production.min.js'],
    ['react-dom/umd/react-dom.development.js', './react-dom.production.min.js'],
    'office-ui-fabric-react/dist/office-ui-fabric-react.js',
    'office-ui-fabric-react/dist/css/fabric.css',
    'highlight.js/styles/github.css',
    'jshexgrid/hexgrid.js',
    'qrcode/build/qrcode.js',
    'pure-notify/dist/pure-notify.js',
    'pure-notify/dist/pure-notify.css'
  ],
  rollupExternal: [
    'react',
    'react-dom',
    'fabric',
    'moment',
    'jshex',
    'qrcode',
    'notify'
  ],
  rollupGlobals: {
    moment: 'moment',
    react: 'React',
    'react-dom': 'ReactDOM',
    fabric: 'Fabric',
    jshex: 'JSHexGrid',
    qrcode: 'QRCode',
    notify: 'PureNotify'
  },
  rollupAlias: {
    
  }
};
