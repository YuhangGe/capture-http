const _util = require('../util');
const config = require('../config');
const path = require('path');
const componentPath = path.join(config.entryRoot, 'component');
const entryModulePath = path.join(config.entryRoot, 'skeleton/module');
const modulePath = path.join(config.root, 'module');
const distDir = path.join(config.root, config.buildMode ? 'dist' :  '.tmp', 'js');

async function readModule(m, dir, prefix) {
  if (typeof prefix === 'undefined') prefix = m;
  let st = await _util.stat(path.join(dir, m));
  if (!st.isDirectory()) return null;
  const lDir = path.join(dir, m, 'locale');
  try {
    st = await _util.stat(lDir);
  } catch(ex) {
    if (ex.code === 'ENOENT') {
      return null;
    }
  }
  if (!st.isDirectory()) {
    console.log(`WARN: locale directory not found: ${lDir}`.yellow);
    return null;
  }
  const locales = await _util.readdir(lDir);
  const dicts = {};
  (await Promise.all(
    locales.map(locale => readLocale(locale, lDir, prefix))
  )).forEach(result => {
    if (!result) return;
    let dict = dicts[result.locale];
    if (!dict) dict = dicts[result.locale] = {};
    for(const key in result.dict) {
      if (dict[key]) throw new Error(`Locale dict key ${key} duplicated`);
      dict[key] = result.dict[key];
    }
  });

  return dicts;
}

async function readLocale(locale, mDir, prefix = '') {
  if (!/^\w+$/.test(locale)) return null;
  const dir = path.join(mDir, locale);
  const stat = await _util.stat(dir);
  if (!stat.isDirectory()) {
    return null;
  }
  const output = {};
  const files = await _util.readdir(dir);
  for(let k = 0; k < files.length; k++) {
    const file = files[k];
    if (!/\.json$/.test(file)) {
      continue;
    }
    const cnt = await _util.readFile(path.join(dir, file));
    try {
      const dict = JSON.parse(cnt);
      for(const key in dict) {
        let okey = file === '_.json' ? key : file.substring(0, file.lastIndexOf('.') + 1) + key;
        okey = (prefix ? prefix + '.' : '') + okey;
        if (output[okey]) {
          throw new Error(`Locale dict key ${okey} duplicated`);
        }
        output[okey] = dict[key];
      }
    } catch(ex) {
      console.error(`Parse locale json file ${path.relative(config.root, path.join(dir, file)).red} error.`);
      console.error(ex);
    }
  }
  return {
    locale,
    dict: output
  };
}

async function bundle(arr, outputName, mergeNgLocale = false) {
  // 合并全部语言字典
  const locales = {};
  arr.forEach(result => {
    if (!result) return;
    for(const lang in result) {
      let dict = locales[lang];
      if (!dict) dict = locales[lang] = {};
      for(const key in result[lang]) {
        if (dict[key]) throw new Error(`Locale dict key ${key} duplicated`);
        dict[key] = result[lang][key];
      }
    }
  });
  const hash = config.buildMode ? '.' + (await _util.getGitHash()) : '';
  const localeFileTemplate = `${outputName}.locale.\${locale}${hash}.js`;
  for(const lang in locales) {
    let tpl = `return ${JSON.stringify(locales[lang], null, 2)};`;
    if (mergeNgLocale) {
      const ngLocale = await _util.readFile(path.join(config.entryRoot, `component/global/locale/${lang}/ng_locale_${lang}.js`));
      tpl = ngLocale + '\n' + tpl;
    }
    await _util.writeFile(path.join(distDir, localeFileTemplate.replace('${locale}', lang)), tpl);
    console.log('Generate LOCALE', localeFileTemplate.replace('${locale}', lang).green);
  }

  return `js/${localeFileTemplate}`;
 
}

const files = { entry: null, main: null };

module.exports = async function generate(changedFile = null) {
  await _util.mkdir(distDir, true);
  if (!changedFile || changedFile.startsWith(componentPath)) {
    // 加载所有组件的多语言
    const arr = await Promise.all(
      (await _util.readdir(componentPath))
        .map(cDir => readModule(cDir, componentPath, 'component' + (cDir === 'global' ? '' : `.${cDir}`)))
    );
    files.entry = await bundle(arr, 'pentagon-entry', true);
  }
  if (!changedFile || !changedFile.startsWith(componentPath)) {
    const isServerAppMode = config.server.mode === 'app';
    const arr = isServerAppMode ? [] : [await readModule('global', entryModulePath)];
    if (config.root !== config.entryRoot) {
      arr.push(...(await Promise.all(
        (await _util.readdir(modulePath))
          .map(mDir => readModule(mDir, modulePath))
      )));
      if (!isServerAppMode && config.loadDemoModule) {
        arr.push(await readModule('demo', entryModulePath));
      }
    } else if (!isServerAppMode) {
      arr.push(await readModule('demo', entryModulePath));
    }
    files.main = await bundle(arr, config.pkgName);
  }
  return files;
};
