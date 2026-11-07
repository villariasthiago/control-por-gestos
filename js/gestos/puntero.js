// Gesto "puntero" para Star Force. Port de starforce/control_starforce.py
// + Modo Inercia descripto en la documentación del proyecto.
// Trabaja en píxeles de una cámara virtual de 640x480 para respetar los umbrales originales.

const PUNTA_INDICE = 8;
const FRAME_REF_MS = 1000 / 30; // UMBRAL_DELTA se calibró a ~30 FPS en Python

const SIN_DIR = { arriba: false, abajo: false, izq: false, der: false };

export function crearPuntero(cfg, cam) {
  const cx = cam.ancho / 2, cy = cam.alto / 2;
  const zona = { xMin: cx - cfg.zonaX, xMax: cx + cfg.zonaX, yMin: cy - cfg.zonaY, yMax: cy + cfg.zonaY };

  let prev = null;          // {x, y, t}
  let dir = { ...SIN_DIR };
  let ultimaVez = -Infinity;
  let ultimo = null;

  function etiqueta(d) {
    return [d.izq ? 'IZQ' : d.der ? 'DER' : '', d.arriba ? 'ARRIBA' : d.abajo ? 'ABAJO' : '']
      .filter(Boolean).join(' ');
  }

  return function procesar(mano, ahoraMs) {
    if (!mano) {
      prev = null;
      if (ultimo && ahoraMs - ultimaVez < cfg.graciaSinManoMs) {
        // MODO INERCIA: la nave sigue con la última velocidad y no deja de disparar.
        return { ...ultimo, conMano: false, inercia: true, modo: 'MODO: INERCIA' };
      }
      dir = { ...SIN_DIR };
      ultimo = null;
      return { conMano: false, inercia: false, ...SIN_DIR, disparar: false,
        dedo: null, dentro: false, modo: 'SIN DETECCION', estado: '', zona };
    }

    const x = mano[PUNTA_INDICE].x * cam.ancho;
    const y = mano[PUNTA_INDICE].y * cam.alto;
    const dentro = x >= zona.xMin && x <= zona.xMax && y >= zona.yMin && y <= zona.yMax;
    let modo;

    if (dentro) {
      modo = 'MODO: RELATIVO';
      if (prev) {
        // Normalizamos el umbral al tiempo real entre detecciones: a 60 FPS el dedo
        // recorre la mitad de píxeles por frame que a 30 FPS.
        const escala = Math.min(2, Math.max(0.5, (ahoraMs - prev.t) / FRAME_REF_MS));
        const umbral = cfg.umbralDelta * escala;
        const dx = x - prev.x, dy = y - prev.y;
        dir = {
          izq: dx < -umbral, der: dx > umbral,
          arriba: dy < -umbral, abajo: dy > umbral,
        };
      }
      // Sin posición previa: se conservan las teclas como estaban (igual que en Python).
    } else {
      modo = 'MODO: CONTINUO';
      dir = {
        izq: x < zona.xMin, der: x > zona.xMax,
        arriba: y < zona.yMin, abajo: y > zona.yMax,
      };
    }

    prev = { x, y, t: ahoraMs };
    ultimaVez = ahoraMs;
    ultimo = { conMano: true, inercia: false, ...dir, disparar: true,
      dedo: { x, y }, dentro, modo, estado: etiqueta(dir), zona };
    return ultimo;
  };
}
