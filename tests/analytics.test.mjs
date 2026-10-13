// Statistiques de visite : index.html reste autonome, avec une seule exception connue (le script Umami).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { htmlPath } from './load-core.mjs';

const html = readFileSync(htmlPath, 'utf8');

test("le script Umami est présent, limité à stria.charlescoiffier.fr et respecte Do Not Track", () => {
  const tag = html.match(/<script[^>]*src="https:\/\/stats\.charlescoiffier\.fr\/script\.js"[^>]*>/);
  assert.ok(tag, 'balise Umami introuvable');
  assert.match(tag[0], /\bdefer\b/);
  assert.match(tag[0], /data-website-id="e67e9d23-dc79-4e47-b82a-cc0df59c7427"/);
  assert.match(tag[0], /data-domains="stria\.charlescoiffier\.fr"/);
  assert.match(tag[0], /data-do-not-track="true"/);
});

test('c’est la seule ressource externe de index.html', () => {
  const external = [...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)=["']https?:\/\/[^"']+/gi)].map((m) => m[0]);
  assert.equal(external.length, 1, `ressources externes : ${external.join(' | ')}`);
});

test('le build accepte cette exception et refuse tout autre script externe', () => {
  const ok = spawnSync(process.execPath, ['scripts/build.mjs'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
});
