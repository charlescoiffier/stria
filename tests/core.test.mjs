import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load-core.mjs';

const { sampleBilinear, gaussBlur, smooth1D, simplifyProfile, buildRibbons } = loadCore();
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b} (±${eps})`);

const baseP = { spacing: 10, wmin: 1, wmax: 9, cut: 0, step: 2.5, smooth: 1.5, tol: 0.05 };

// Projection d'un ruban sur la normale des lignes : renvoie [min, max] relatifs au centre de l'image.
function extent(pts, angle, w, h) {
  const th = angle * Math.PI / 180, nx = -Math.sin(th), ny = Math.cos(th);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    const v = (pts[i] - w / 2) * nx + (pts[i + 1] - h / 2) * ny;
    mn = Math.min(mn, v); mx = Math.max(mx, v);
  }
  return [mn, mx];
}

test('sampleBilinear : valeurs aux centres de pixels et interpolation', () => {
  const m = Float32Array.from([0, 1, 2, 3]); // 2×2
  near(sampleBilinear(m, 2, 2, 0.5, 0.5), 0, 1e-6);
  near(sampleBilinear(m, 2, 2, 1.5, 0.5), 1, 1e-6);
  near(sampleBilinear(m, 2, 2, 1.0, 1.0), 1.5, 1e-6);
  near(sampleBilinear(m, 2, 2, -50, 99), 2, 1e-6, 'bords répliqués');
});

test('gaussBlur : conserve une carte constante, lisse un pic, préserve la moyenne', () => {
  const W = 40, H = 30;
  const flat = new Float32Array(W * H).fill(0.4);
  const bf = gaussBlur(flat, W, H, 3);
  for (const v of bf) near(v, 0.4, 1e-5);

  const spike = new Float32Array(W * H); spike[15 * W + 20] = 1;
  const bs = gaussBlur(spike, W, H, 2);
  assert.ok(bs[15 * W + 20] < 0.2 && bs[15 * W + 20] > 0, 'le pic est étalé');
  near(bs.reduce((a, b) => a + b, 0), 1, 1e-3, 'masse conservée');
  assert.equal(gaussBlur(spike, W, H, 0.1), spike, 'sigma négligeable : pas de flou');
});

test('smooth1D : conserve un profil constant et réduit un saut brusque', () => {
  const c = smooth1D(new Float32Array(20).fill(5), 2);
  for (const v of c) near(v, 5, 1e-5);
  const step = new Float32Array(40).fill(0).fill(10, 20);
  const s = smooth1D(step, 2);
  assert.ok(s[19] > 0 && s[20] < 10, 'transition adoucie');
});

test('simplifyProfile : garde les extrémités, supprime les points alignés, garde les coudes', () => {
  const s = Float32Array.from({ length: 11 }, (_, i) => i);
  const line = Float32Array.from({ length: 11 }, (_, i) => 2 + 0.5 * i);
  assert.deepEqual([...simplifyProfile(s, line, 0, 10, 0.01)], [0, 10]);
  const bent = Float32Array.from({ length: 11 }, (_, i) => (i <= 5 ? i : 10 - i));
  assert.deepEqual([...simplifyProfile(s, bent, 0, 10, 0.01)], [0, 5, 10]);
});

test('buildRibbons : axes parallèles, équidistants et rectilignes quel que soit l’angle', () => {
  const w = 400, h = 300, cov = new Float32Array(w * h).fill(0.5); // largeur constante = 5
  for (const angle of [0, 45, 90, 33, 135]) {
    const rs = buildRibbons(cov, w, h, { ...baseP, angle });
    assert.ok(rs.length > 20, `angle ${angle} : des rubans sont produits`);
    let checked = 0;
    for (const r of rs) {
      const [mn, mx] = extent(r.pts, angle, w, h);
      if (Math.abs((mx - mn) - 5) > 0.05) continue;      // rubans partiellement rognés en bord d'image
      near((mn + mx) / 2, r.k * 10, 1e-3, `angle ${angle}, ligne ${r.k} : écart à l'axe théorique`);
      checked++;
    }
    assert.ok(checked > 15, `angle ${angle} : assez de lignes vérifiées (${checked})`);
  }
});

test('buildRibbons : l’épaisseur reste dans [wmin, wmax] et suit la luminance', () => {
  const w = 400, h = 300, g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x / (w - 1);
  const rs = buildRibbons(g, w, h, { ...baseP, angle: 0 });
  let wMin = Infinity, wMax = -Infinity, prevLeft = null;
  for (const r of rs) {
    const m = r.pts.length / 4;
    for (let q = 0; q < m; q++) {
      const t = Math.abs(r.pts[2 * q + 1] - r.pts[2 * (2 * m - 1 - q) + 1]);
      wMin = Math.min(wMin, t); wMax = Math.max(wMax, t);
    }
    if (r.k === 0) prevLeft = { first: Math.abs(r.pts[1] - r.pts[2 * (2 * m - 1) + 1]),
                                last: Math.abs(r.pts[2 * (m - 1) + 1] - r.pts[2 * m + 1]) };
  }
  assert.ok(wMin >= 1 - 0.05 && wMax <= 9 + 0.05, `plage ${wMin}–${wMax}`);
  assert.ok(prevLeft.last > prevLeft.first + 5, 'plus épais à droite (couverture croissante)');
});

test('buildRibbons : image blanche = lignes à wmin, image noire = lignes à wmax', () => {
  const w = 200, h = 200;
  for (const [v, expected] of [[0, 1], [1, 9]]) {
    const rs = buildRibbons(new Float32Array(w * h).fill(v), w, h, { ...baseP, angle: 45 });
    const r = rs.find(r => r.k === 0), m = r.pts.length / 4;
    const [mn, mx] = extent(r.pts, 45, w, h);
    near(mx - mn, expected, 1e-3);
    assert.ok(m >= 2);
  }
});

test('buildRibbons : le seuil de coupure supprime les tronçons trop fins', () => {
  const w = 300, h = 100, g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x / (w - 1);
  const full = buildRibbons(g, w, h, { ...baseP, angle: 0, cut: 0 });
  const cut = buildRibbons(g, w, h, { ...baseP, angle: 0, cut: 5 });
  const xmin = rs => Math.min(...rs.map(r => Math.min(...r.pts.filter((_, i) => i % 2 === 0))));
  assert.ok(xmin(cut) > xmin(full) + 50, 'la zone claire (gauche) n’est plus tracée');
});

test('buildRibbons : des rubans fermés dont tous les points sont finis', () => {
  const w = 120, h = 90, g = new Float32Array(w * h).map((_, i) => ((i * 7919) % 100) / 100);
  for (const r of buildRibbons(g, w, h, { ...baseP, angle: 61 })) {
    assert.ok(r.pts.length >= 8 && r.pts.length % 4 === 0);
    for (const v of r.pts) assert.ok(Number.isFinite(v));
  }
});
