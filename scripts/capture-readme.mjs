// Régénère les captures du README (docs/images/*.png) avec Chrome en mode headless.
// Usage : npm run capture:readme   (variable CHROME pour indiquer un autre exécutable)
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chrome)) throw new Error(`Chrome introuvable : ${chrome} (définir CHROME)`);
const page = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;
const out = fileURLToPath(new URL('../docs/images/', import.meta.url));
mkdirSync(out, { recursive: true });

// [nom, paramètres d'URL, taille de fenêtre, facteur d'échelle]. Fenêtre ≥ 500 px : Chrome headless refuse plus étroit.
const DESKTOP = '1280,880', PHONE = '500,900';
const shots = [
  ['stria', '?theme=dark', DESKTOP, 1],
  ['points', '?theme=dark&style=dots&layout=hex', DESKTOP, 1],
  ['stochastique', '?theme=dark&style=stochastic', DESKTOP, 1],
  ['hachures', '?theme=dark&style=hatch', DESKTOP, 1],
  ['clair', '?theme=light&style=dots&layout=hex', DESKTOP, 1],
  ['mobile', '?theme=dark&style=stochastic', PHONE, 1],
  ['mobile-reglages', '?theme=light&style=hatch&panel=open', PHONE, 1],
];
for (const [name, query, size, scale] of shots) {
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${size}`,
    `--force-device-scale-factor=${scale}`, '--virtual-time-budget=6000', `--screenshot=${out}${name}.png`, page + query],
    { stdio: 'ignore' });
  console.log(`docs/images/${name}.png`);
}
