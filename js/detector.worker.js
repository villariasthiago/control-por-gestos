// Web Worker: saca MediaPipe del hilo principal para que el emulador no pierda frames ni audio.
import { crearDetector } from './detector-nucleo.js';

let detector = null;

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.tipo === 'iniciar') {
    try {
      detector = await crearDetector({ ...msg, enWorker: true });
      self.postMessage({ tipo: 'listo', delegado: detector.delegado });
    } catch (e) {
      self.postMessage({ tipo: 'error', error: String(e && e.message || e) });
    }
  } else if (msg.tipo === 'frame') {
    const t0 = performance.now();
    let mano = null;
    try {
      mano = detector.detectar(msg.imagen, msg.ts);
    } catch (e) {
      self.postMessage({ tipo: 'error', error: String(e && e.message || e) });
    } finally {
      msg.imagen.close();
    }
    self.postMessage({ tipo: 'resultado', mano, ts: msg.ts, ms: performance.now() - t0 });
  }
};
