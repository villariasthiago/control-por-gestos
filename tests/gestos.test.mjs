import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearVolante, medirMano } from '../js/gestos/volante.js';
import { crearPuntero } from '../js/gestos/puntero.js';
import { esGestoOk, crearGestoStart } from '../js/gestos/start.js';
import { OUTRUN, STARFORCE, CAMARA } from '../js/config.js';

// Mano sintética: ángulo de la palma (grados, coords de imagen) y extensión del índice.
function mano({ angulo = -90, ratioIndice = 1.8, cx = 0.5, cy = 0.7, ok = false } = {}) {
  const p = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  const r = (a) => (a * Math.PI) / 180;
  const en = (dist, desvio) => ({
    x: cx + dist * Math.cos(r(angulo + desvio)),
    y: cy + dist * Math.sin(r(angulo + desvio)),
    z: 0,
  });
  p[9] = en(0.15, 0);          // base medio
  p[5] = en(0.14, -12);        // base índice
  p[8] = en(0.14 * ratioIndice, -12);
  p[10] = en(0.2, 0); p[12] = en(0.28, 0);
  p[13] = en(0.14, 12); p[14] = en(0.19, 12); p[16] = en(0.26, 12);
  p[17] = en(0.13, 24); p[18] = en(0.17, 24); p[20] = en(0.23, 24);
  p[4] = ok ? { ...p[8], x: p[8].x + 0.01 } : en(0.12, -50);
  return p;
}

test('medirMano: mano vertical da -90° y respeta el ratio', () => {
  const m = medirMano(mano({ angulo: -90, ratioIndice: 1.8 }));
  assert.ok(Math.abs(m.angulo + 90) < 0.01);
  assert.ok(Math.abs(m.ratio - 1.8) < 0.01);
});

test('volante: zona muerta, izquierda y derecha', () => {
  const v = crearVolante(OUTRUN);
  assert.equal(v(mano({ angulo: -90 }), 0).direccion, 'CENTRO');
  assert.equal(v(mano({ angulo: -100 }), 10).direccion, 'CENTRO');
  const izq = v(mano({ angulo: -125 }), 20);
  assert.equal(izq.direccion, 'IZQUIERDA'); assert.ok(izq.izq && !izq.der);
  const der = v(mano({ angulo: -55 }), 30);
  assert.equal(der.direccion, 'DERECHA'); assert.ok(der.der && !der.izq);
});

test('volante: palma acelera, puño dispara la marcha UNA sola vez', () => {
  const v = crearVolante(OUTRUN);
  assert.equal(v(mano({ ratioIndice: 1.8 }), 0).acelerar, true);
  assert.equal(v(mano({ ratioIndice: 1.35 }), 10).acelerar, false); // entre umbrales: neutro
  const p1 = v(mano({ ratioIndice: 1.0 }), 20);
  assert.equal(p1.marcha, true); assert.equal(p1.acelerar, false);
  assert.equal(v(mano({ ratioIndice: 1.0 }), 30).marcha, false);   // sigue cerrado: no repite
  v(mano({ ratioIndice: 1.8 }), 40);                                 // abre
  assert.equal(v(mano({ ratioIndice: 1.0 }), 50).marcha, true);      // cierra de nuevo
});

test('volante: gracia sin mano sostiene y luego suelta todo', () => {
  const v = crearVolante(OUTRUN);
  v(mano({ angulo: -125, ratioIndice: 1.8 }), 1000);
  const corto = v(null, 1000 + OUTRUN.graciaSinManoMs - 10);
  assert.ok(corto.inercia && corto.izq && corto.acelerar && !corto.marcha);
  const largo = v(null, 1000 + OUTRUN.graciaSinManoMs + 10);
  assert.ok(!largo.izq && !largo.acelerar && !largo.conMano);
});

// Punta del índice en píxeles de la cámara virtual 640x480.
const dedo = (x, y) => {
  const m = mano();
  m[8] = { x: x / CAMARA.ancho, y: y / CAMARA.alto, z: 0 };
  return m;
};

test('puntero: modo continuo fuera del cuadro central', () => {
  const p = crearPuntero(STARFORCE, CAMARA);
  const e = p(dedo(50, 50), 0);
  assert.equal(e.modo, 'MODO: CONTINUO');
  assert.ok(e.izq && e.arriba && !e.der && !e.abajo);
  assert.equal(e.disparar, true);
  const e2 = p(dedo(600, 240), 33);
  assert.ok(e2.der && !e2.arriba && !e2.abajo);
});

test('puntero: modo relativo usa el delta y normaliza por tiempo', () => {
  const p = crearPuntero(STARFORCE, CAMARA);
  p(dedo(320, 240), 0);
  const quieto = p(dedo(321, 240), 33);
  assert.equal(quieto.modo, 'MODO: RELATIVO'); assert.ok(!quieto.izq && !quieto.der);
  const mov = p(dedo(330, 237), 66);
  assert.ok(mov.der && !mov.arriba); // dy=-3 no supera el umbral (4)
  // A 60 FPS, 3 px en 16 ms equivale a 6 px a 30 FPS: debe contar.
  const rapido = p(dedo(333, 240), 82);
  assert.ok(rapido.der);
});

test('puntero: modo inercia mantiene dirección y disparo', () => {
  const p = crearPuntero(STARFORCE, CAMARA);
  p(dedo(600, 240), 0);
  const i = p(null, 100);
  assert.equal(i.modo, 'MODO: INERCIA'); assert.ok(i.der && i.disparar);
  const fin = p(null, STARFORCE.graciaSinManoMs + 10);
  assert.ok(!fin.der && !fin.disparar);
});

test('start: gesto OK sostenido dispara START con enfriamiento', () => {
  assert.equal(esGestoOk(mano({ ok: true })), true);
  assert.equal(esGestoOk(mano()), false);
  const s = crearGestoStart({ sostenerMs: 800, enfriamientoMs: 1500 });
  assert.equal(s(mano({ ok: true }), 0).disparar, false);
  assert.equal(s(mano({ ok: true }), 400).disparar, false);
  assert.equal(s(mano({ ok: true }), 800).disparar, true);
  assert.equal(s(mano({ ok: true }), 1700).disparar, false); // enfriamiento
});
