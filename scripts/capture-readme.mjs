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

const shots = [
  ['stria', ''],
  ['points', '?style=dots&layout=hex'],
  ['stochastique', '?style=stochastic'],
  ['hachures', '?style=hatch'],
];
for (const [name, query] of shots) {
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,880',
    '--force-device-scale-factor=1', '--virtual-time-budget=6000', `--screenshot=${out}${name}.png`, page + query],
    { stdio: 'ignore' });
  console.log(`docs/images/${name}.png`);
}
