// Resolución de dependencias: primero lo que está vendorizado en el repo (vendor/),
// si no existe, CDN oficial. Así el sitio funciona igual en local y en GitHub Pages,
// y en el stand no dependemos de terceros si el deploy incluyó vendor/.
import { VERSIONES } from './config.js';

const abs = (p) => new URL(p, location.href).href;

async function existe(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function rutasEmulador() {
  const local = abs('vendor/emulatorjs/data/');
  if (await existe(local + 'loader.js')) {
    // vendor.sh copia las fuentes sin minificar (data/src): EJS_DEBUG_XX las carga directo.
    return { data: local, debug: true, origen: 'local' };
  }
  return { data: `https://cdn.emulatorjs.org/${VERSIONES.emulatorjs}/data/`, debug: false, origen: 'cdn' };
}

export async function rutasMediapipe() {
  const base = abs('vendor/mediapipe/');
  const modeloLocal = abs('vendor/modelos/hand_landmarker.task');
  const [libLocal, modLocal] = await Promise.all([
    existe(base + 'vision_bundle.mjs'),
    existe(modeloLocal),
  ]);
  const cdn = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSIONES.mediapipe}/`;
  return {
    bundle: libLocal ? base + 'vision_bundle.mjs' : cdn + 'vision_bundle.mjs',
    wasm: libLocal ? base + 'wasm' : cdn + 'wasm',
    modelo: modLocal
      ? modeloLocal
      : 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    origen: libLocal && modLocal ? 'local' : 'cdn',
  };
}
