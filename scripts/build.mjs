// « Build » : Stria est un fichier autonome, il n'y a rien à compiler. Ce script valide index.html
// (script inline compilable, marqueurs du cœur présents) puis le copie dans dist/, prêt à être publié.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import vm from 'node:vm';
import { extractCore, htmlPath } from '../tests/load-core.mjs';

const html = readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error(`Un seul <script> inline attendu, ${scripts.length} trouvé(s)`);
new vm.Script(scripts[0][1], { filename: 'index.html' });
extractCore(html);
// Seule exception à l'autonomie : le script de statistiques de visite (Umami, sans cookie).
const ANALYTICS = /<script defer src="https:\/\/stats\.charlescoiffier\.fr\/script\.js"[^>]*><\/script>/;
if (/<script[^>]+src=|<link[^>]+href=["']https?:/i.test(html.replace(ANALYTICS, ''))) throw new Error('index.html doit rester autonome (aucune ressource externe, hors statistiques de visite)');

const out = new URL('../dist/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(new URL('index.html', out), html);
console.log(`dist/index.html écrit (${(html.length / 1024).toFixed(1)} Ko)`);
