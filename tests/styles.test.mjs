import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load-core.mjs';

const { buildDots, stochasticDots, hatchCoverages, hatchAngles, buildHatch, mulberry32 } = loadCore();
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b} (±${eps})`);
const flat = (w, h, v) => new Float32Array(w * h).fill(v);
const ramp = (w, h) => { const g = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x / (w - 1); return g; };
const dotsOf = c => Array.from({ length: c.length / 3 }, (_, i) => ({ x: c[3 * i], y: c[3 * i + 1], r: c[3 * i + 2] }));

function nearest(pts) {   // distance minimale entre deux points (force brute, jeux de test petits)
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return m;
}

/* ---------- points (trame régulière) ---------- */

test('buildDots carré : un point par cellule, voisins à une distance égale à l’espacement', () => {
  const w = 300, h = 200, p = 10;
  for (const angle of [0, 45, 27]) {
    const d = dotsOf(buildDots(flat(w, h, 0.5), w, h, { spacing: p, angle, layout: 'square', dmin: 0, dmax: 12, cut: 0 }));
    near(d.length, w * h / (p * p), w * h / (p * p) * 0.15, `angle ${angle} : nombre de points`);
    near(nearest(d.slice(0, 400)), p, 1e-3, `angle ${angle} : plus proche voisin`);
  }
});

test('buildDots quinconce : réseau hexagonal, densité 2/√3 fois celle du réseau carré', () => {
  const w = 300, h = 200, p = 10;
  const sq = dotsOf(buildDots(flat(w, h, 0.5), w, h, { spacing: p, angle: 0, layout: 'square', dmin: 0, dmax: 12, cut: 0 }));
  const hx = dotsOf(buildDots(flat(w, h, 0.5), w, h, { spacing: p, angle: 0, layout: 'hex', dmin: 0, dmax: 12, cut: 0 }));
  near(hx.length / sq.length, 2 / Math.sqrt(3), 0.1);
  near(nearest(hx.slice(0, 400)), p, 1e-3, 'toutes les distances entre voisins valent p');
  const rows = [...new Set(hx.map(q => q.y.toFixed(3)))].map(Number).sort((a, b) => a - b);
  near(rows[1] - rows[0], p * Math.sqrt(3) / 2, 1e-3, 'écart entre rangées');
});

test('buildDots : le diamètre suit √couverture, et le seuil supprime les points trop petits', () => {
  const w = 100, h = 100, P = { spacing: 10, angle: 0, layout: 'square', dmin: 0, dmax: 12, cut: 0 };
  for (const t of [0.25, 1]) {
    for (const q of dotsOf(buildDots(flat(w, h, t), w, h, P))) near(2 * q.r, 12 * Math.sqrt(t), 1e-5);
  }
  assert.equal(buildDots(flat(w, h, 0), w, h, P).length, 0, 'image blanche : aucun point');
  assert.equal(buildDots(flat(w, h, 0.01), w, h, { ...P, cut: 2 }).length, 0, 'sous le seuil');
});

test('buildDots : les diamètres croissent avec la couverture sur un dégradé', () => {
  const w = 200, h = 100, d = dotsOf(buildDots(ramp(w, h), w, h, { spacing: 10, angle: 0, layout: 'square', dmin: 0, dmax: 12, cut: 0 }));
  const left = d.filter(q => q.x < 60), right = d.filter(q => q.x > 140);
  const avg = a => a.reduce((s, q) => s + q.r, 0) / a.length;
  assert.ok(avg(right) > avg(left) * 1.8);
});

/* ---------- stochastique ---------- */

test('stochasticDots : déterministe pour une graine donnée, différent pour une autre', () => {
  const w = 120, h = 80, cov = flat(w, h, 0.4), P = { dot: 3, cut: 0.02, seed: 7 };
  const a = stochasticDots(cov, w, h, P), b = stochasticDots(cov, w, h, P), c = stochasticDots(cov, w, h, { ...P, seed: 8 });
  assert.deepEqual([...a], [...b]);
  assert.notDeepEqual([...a], [...c]);
});

test('stochasticDots : diamètre constant, points dans l’image, distance minimale respectée', () => {
  const w = 120, h = 80, dot = 3, d = dotsOf(stochasticDots(flat(w, h, 0.6), w, h, { dot, cut: 0.02, seed: 1 }));
  assert.ok(d.length > 200);
  for (const q of d) { near(q.r, dot / 2, 1e-6); assert.ok(q.x >= 0 && q.x < w && q.y >= 0 && q.y < h); }
  assert.ok(nearest(d) >= dot * 0.7 * 0.999, 'bruit bleu : jamais plus proches que K·d');
});

test('stochasticDots : la densité suit la couverture (dégradé, blanc, noir)', () => {
  const w = 200, h = 100, P = { dot: 2.5, cut: 0.02, seed: 3 };
  const d = dotsOf(stochasticDots(ramp(w, h), w, h, P));
  const count = (a, b) => d.filter(q => q.x >= a && q.x < b).length;
  const l = count(0, 50), m = count(75, 125), r = count(150, 200);
  assert.ok(l < m && m < r, `densités ${l} < ${m} < ${r}`);
  // couverture obtenue ≈ couverture demandée (point = π(d/2)² ; zone centrale c≈0.5)
  const covered = m * Math.PI * (P.dot / 2) ** 2 / (50 * h);
  near(covered, 0.5, 0.2, 'couverture au centre');
  assert.equal(stochasticDots(flat(w, h, 0), w, h, P).length, 0, 'image blanche : aucun point');
  assert.ok(stochasticDots(flat(w, h, 1), w, h, P).length > 1000, 'image noire : très dense');
});

test('mulberry32 : suite reproductible dans [0, 1)', () => {
  const a = mulberry32(5), b = mulberry32(5);
  for (let i = 0; i < 100; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
});

/* ---------- hachures croisées ---------- */

test('hatchCoverages : la couverture totale 1 − Π(1 − aᵢ) reproduit la tonalité tant que les passes ne saturent pas', () => {
  for (const n of [2, 3, 4]) for (const c of [0, 0.1, 0.4, 0.7, 0.8]) {
    const a = hatchCoverages(c, n, 0.5), total = 1 - a.reduce((k, x) => k * (1 - x), 1);
    near(total, Math.min(c, 1 - 0.5 ** n), 1e-9, `n=${n}, c=${c}`);
    for (const x of a) assert.ok(x >= 0 && x <= 0.5 + 1e-12);
  }
});

test('hatchCoverages : passes ajoutées progressivement (la 2e n’apparaît qu’une fois la 1re saturée)', () => {
  const a = hatchCoverages(0.3, 3, 0.5);
  near(a[0], 0.3, 1e-9); assert.equal(a[1], 0); assert.equal(a[2], 0);
  const b = hatchCoverages(0.6, 3, 0.5);
  near(b[0], 0.5, 1e-9); assert.ok(b[1] > 0 && b[2] === 0);
});

test('hatchAngles : angles répartis sur 180°, les plus contrastés d’abord', () => {
  assert.deepEqual([...hatchAngles(2)], [0, 90]);
  assert.deepEqual([...hatchAngles(3)], [0, 60, 120]);
  assert.deepEqual([...hatchAngles(4)], [0, 90, 45, 135]);
});

test('buildHatch : passes superposées à des angles différents, plus de passes dans les zones sombres', () => {
  const w = 300, h = 200, P = { spacing: 8, angle: 45, passes: 3, amax: 0.5, cut: 0.05, step: 2, smooth: 1.5, tol: 0.05 };
  const rs = buildHatch(ramp(w, h), w, h, P);
  const layers = new Set(rs.map(r => r.layer));
  assert.deepEqual([...layers].sort(), [0, 1, 2]);
  const meanX = l => { let s = 0, n = 0; for (const r of rs.filter(r => r.layer === l)) for (let i = 0; i < r.pts.length; i += 2) { s += r.pts[i]; n++; } return s / n; };
  assert.ok(meanX(0) < meanX(1) && meanX(1) < meanX(2), 'les passes suivantes se concentrent vers le noir');
  assert.equal(buildHatch(flat(w, h, 0), w, h, P).length, 0, 'image blanche : rien');
  for (const r of rs) for (const v of r.pts) assert.ok(Number.isFinite(v));
});
