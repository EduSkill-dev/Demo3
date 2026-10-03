#!/usr/bin/env node
/**
 * Lists keys that exist in the Armenian dictionary but are missing from the
 * Russian or English one (those fall back to Armenian on screen).
 *
 *   node scripts/check-i18n.cjs     # exits 1 when something is missing
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function load(locale) {
  const file = path.join(process.cwd(), 'src/i18n/dictionaries', `${locale}.ts`);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', js)(module, module.exports, () => ({}));
  return module.exports.default;
}

function leaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`)
  );
}

const source = leaves(load('hy'));
let missing = 0;
for (const locale of ['ru', 'en']) {
  const have = new Set(leaves(load(locale)));
  // Language names are shown in their own language, so they stay shared.
  const gaps = source.filter((k) => !have.has(k) && !/^language\.(hy|ru|en)$/.test(k) && !/^package\.(start|advanced|pro)$/.test(k));
  missing += gaps.length;
  console.log(`${locale}: ${gaps.length ? gaps.length + ' missing' : 'complete'}`);
  gaps.forEach((k) => console.log('   - ' + k));
}
process.exit(missing ? 1 : 0);
