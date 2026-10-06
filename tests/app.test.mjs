// Garde-fous sur index.html lui-même : le script se compile, et les textes FR/EN restent synchronisés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { htmlPath } from './load-core.mjs';

const html = readFileSync(htmlPath, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

test('le script inline est syntaxiquement valide', () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test('les dictionnaires FR et EN ont les mêmes clés', () => {
  const block = script.slice(script.indexOf('const I18N = '), script.indexOf('let lang'));
  const I18N = vm.runInNewContext(block.replace('const I18N = ', '(') .replace(/;\s*$/, ')'));
  assert.deepEqual(Object.keys(I18N.fr).sort(), Object.keys(I18N.en).sort());
});

test('chaque data-i18n du HTML a une traduction', () => {
  const block = script.slice(script.indexOf('const I18N = '), script.indexOf('let lang'));
  const I18N = vm.runInNewContext(block.replace('const I18N = ', '(').replace(/;\s*$/, ')'));
  const keys = [...html.matchAll(/data-i18n="(\w+)"/g)].map(m => m[1]);
  assert.ok(keys.length > 5);
  for (const k of keys) assert.ok(k in I18N.fr && k in I18N.en, `clé manquante : ${k}`);
});
