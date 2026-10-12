// Charge le cœur algorithmique de index.html (entre les marqueurs @core-start / @core-end) sans navigateur.
// index.html reste un fichier autonome : il s'ouvre par double-clic, sans serveur ni étape de build.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const htmlPath = fileURLToPath(new URL('../index.html', import.meta.url));

export function extractCore(html = readFileSync(htmlPath, 'utf8')) {
  const start = html.indexOf('/* @core-start */');
  const end = html.indexOf('/* @core-end */');
  if (start < 0 || end < start) throw new Error('Marqueurs @core-start / @core-end introuvables dans index.html');
  return html.slice(start, end);
}

export function loadCore() {
  const code = extractCore() +
    '\n({ clamp, sampleBilinear, gaussBlur, smooth1D, simplifyProfile, clipRange, buildRibbons,\n' +
    '   mulberry32, buildDots, stochasticDots, hatchCoverages, hatchAngles, buildHatch });';
  return vm.runInNewContext(code, { Math, Float32Array, Int32Array, Array, Object });
}
