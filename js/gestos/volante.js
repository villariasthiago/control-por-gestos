// Gesto "volante" para OutRun. Port de outrun/control_juego.py.
// Función pura: recibe landmarks (ya espejados, coords normalizadas 0..1) y devuelve
// qué botones tienen que estar apretados. No toca el DOM ni el emulador.

const MUNECA = 0, BASE_INDICE = 5, PUNTA_INDICE = 8, BASE_MEDIO = 9;

const NEUTRO = Object.freeze({
  conMano: false, inercia: false,
  izq: false, der: false, acelerar: false, marcha: false,
  direccion: 'CENTRO', accion: 'NEUTRO', angulo: -90,
});

export function medirMano(mano) {
  const m = mano[MUNECA], bm = mano[BASE_MEDIO], ti = mano[PUNTA_INDICE], bi = mano[BASE_INDICE];
  const angulo = Math.atan2(bm.y - m.y, bm.x - m.x) * 180 / Math.PI;
  const distPunta = Math.hypot(ti.x - m.x, ti.y - m.y);
  const distBase = Math.hypot(bi.x - m.x, bi.y - m.y);
  return { angulo, ratio: distBase > 0 ? distPunta / distBase : 0 };
}

export function crearVolante(cfg) {
  let marchaDisparada = false;
  let ultimaVez = -Infinity;
  let ultimo = NEUTRO;

  return function procesar(mano, ahoraMs) {
    if (!mano) {
      // Pérdida breve del tracking: sostener dirección/acelerador, nunca re-disparar marcha.
      if (ahoraMs - ultimaVez < cfg.graciaSinManoMs && ultimo.conMano) {
        return { ...ultimo, marcha: false, inercia: true };
      }
      marchaDisparada = false;
      ultimo = NEUTRO;
      return NEUTRO;
    }

    const { angulo, ratio } = medirMano(mano);
    const esPunio = ratio < cfg.ratioPunio;
    const esAbierta = ratio > cfg.ratioPalma;

    let direccion = 'CENTRO';
    if (angulo < cfg.anguloIzq) direccion = 'IZQUIERDA';
    else if (angulo > cfg.anguloDer) direccion = 'DERECHA';

    const acelerar = esAbierta && !esPunio;
    let accion = acelerar ? 'ACELERANDO' : 'NEUTRO';

    // Flanco de subida del puño: un solo pulso por cierre (igual que marcha_disparada en Python).
    let marcha = false;
    if (esPunio) {
      accion = 'CAMBIO MARCHA';
      if (!marchaDisparada) { marcha = true; marchaDisparada = true; }
    } else {
      marchaDisparada = false;
    }

    ultimaVez = ahoraMs;
    ultimo = {
      conMano: true, inercia: false,
      izq: direccion === 'IZQUIERDA', der: direccion === 'DERECHA',
      acelerar, marcha, direccion, accion, angulo, ratio,
    };
    return ultimo;
  };
}
