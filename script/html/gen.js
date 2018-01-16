const _util = require('../util');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { handleLib } = require('./_min');
const distDir = path.join(config.root, config.buildMode ? 'dist' : '.tmp');

const EMPTY_SERVER = { port: 8000 };
const LIVE_CODE = fs.readFileSync(path.join(__dirname, '_tpl.live.js'), 'utf-8');

async function _write(libs, renders, ext) {
  if (renders.length === 0) return null;
  const hash = await _util.calcFileHash(libs.join(','), false);
  const fn = `${config.pkgName}.render.${config.buildMode ? 'min.' : ''}${hash}${ext}`;
  const fullpath = path.join(distDir, ext.substring(1), fn);
  if (!(await _util.exists(fullpath))) {
    await _util.mkdir(path.dirname(fullpath), true);
    await _util.writeFile(fullpath, '/*\n' + libs.join('\n') + '\n*/\n' + renders.join('\n\n'));
    console.log('Merged lib', libs.map(l => `\n\t${l.green}`).join('') + '\n\tto ' + fn.green);
  }
  return path.join(ext.substring(1), fn);
}

async function generate(reloadServer = EMPTY_SERVER, cssFile = 'css/capture-http.css', jsFile = 'js/capture-http.js') {
  await _util.mkdir(path.join(distDir, 'js'), true);

  let html = await _util.readFile(path.join(config.root, 'app/index.htm'), 'utf-8');
  if (!config.buildMode) {
    const idx = html.indexOf('<head>');
    html = html.substring(0, idx + 6) + '\n<script>\n' + LIVE_CODE.replace('${PORT}', reloadServer.port) + '\n</script>\n' + html.substring(idx + 6);
  }
  
  const jsLibs = [];
  const jsLibRenders = [];
  const cssLibs = [];
  const cssLibRenders = [];
  (await Promise.all(config.libs.map(lib => handleLib(lib)))).forEach(result => {
    const [fn, cnt] =  result;
    if (fn.endsWith('.js')) {
      jsLibs.push(fn);
      jsLibRenders.push(cnt);
    } else {
      cssLibs.push(fn);
      cssLibRenders.push(cnt);
    }
  });

  const result = await Promise.all([
    _write(jsLibs, jsLibRenders, '.js'),
    _write(cssLibs, cssLibRenders, '.css')
  ]);

  const cssRenders = result[1] ? [ result[1], cssFile ] : [ cssFile ];
  const jsRenders = result[0] ? [ result[0], jsFile ] : [ jsFile ];
  
  html = html.replace(/<\/body>\s*<\/html>\s*$/, () => {
    return `
  ${cssRenders.map(f => `<link rel="stylesheet" href="${f}"/>`).join('\n  ')}
  ${jsRenders.map(f => `<script src="${f}"></script>`).join('\n  ')}
` + '\n</body>\n</html>';
  });
  await _util.writeFile(path.join(distDir, 'index.html'), html);
  console.log('Generate', 'index.html'.green);

}

module.exports = generate;
