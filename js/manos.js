// Cámara + seguimiento de mano. Equivale a la captura de OpenCV + MediaPipe del motor.py,
// pero dentro del navegador: el video nunca sale de la computadora del jugador.
import { CAMARA, DETECCION } from './config.js';
import { rutasMediapipe } from './rutas.js';
import { crearDetector } from './detector-nucleo.js';

export class SeguidorManos {
  constructor({ video, alResultado, alEstado }) {
    this.video = video;
    this.alResultado = alResultado;
    this.alEstado = alEstado || (() => {});
    this.ocupado = false;
    this.activo = false;
    this.modo = null;          // 'worker' | 'principal'
    this.stats = { fps: 0, ms: 0, delegado: '-', origen: '-' };
    this._cuentaFrames = 0;
    this._t0 = performance.now();
  }

  async iniciarCamara() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no permite usar la cámara (se necesita HTTPS o localhost).');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: CAMARA.ancho }, height: { ideal: CAMARA.alto },
        frameRate: { ideal: 30, max: 60 }, facingMode: 'user' },
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
  }

  async iniciarDetector() {
    const rutas = await rutasMediapipe();
    this.stats.origen = rutas.origen;
    const params = { bundle: rutas.bundle, wasm: rutas.wasm, modelo: rutas.modelo, opciones: { ...DETECCION } };

    this.alEstado('Cargando modelo de manos…');
    try {
      await this._iniciarWorker(params);
      this.modo = 'worker';
    } catch (e) {
      console.warn('[manos] Worker no disponible, uso hilo principal:', e);
      this.detector = await crearDetector({ ...params, enWorker: false });
      this.stats.delegado = this.detector.delegado;
      this.modo = 'principal';
    }
    this.alEstado(null);
  }

  _iniciarWorker(params) {
    if (typeof createImageBitmap !== 'function' || typeof Worker !== 'function') {
      return Promise.reject(new Error('Sin soporte de Worker/ImageBitmap'));
    }
    return new Promise((resolve, reject) => {
      const w = new Worker(new URL('./detector.worker.js', import.meta.url), { type: 'module' });
      const timeout = setTimeout(() => { w.terminate(); reject(new Error('timeout worker')); }, 30000);
      w.onerror = (e) => { clearTimeout(timeout); w.terminate(); reject(e.error || new Error(e.message || 'worker error')); };
      w.onmessage = (ev) => {
        const m = ev.data;
        if (m.tipo === 'listo') {
          clearTimeout(timeout);
          this.stats.delegado = m.delegado;
          w.onmessage = (e2) => this._mensajeWorker(e2.data);
          this.worker = w;
          resolve();
        } else if (m.tipo === 'error') {
          clearTimeout(timeout); w.terminate(); reject(new Error(m.error));
        }
      };
      w.postMessage({ tipo: 'iniciar', ...params });
    });
  }

  _mensajeWorker(m) {
    if (m.tipo === 'resultado') {
      this.ocupado = false;
      this._entregar(m.mano, m.ts, m.ms);
    } else if (m.tipo === 'error') {
      this.ocupado = false;
      console.warn('[manos] error en worker:', m.error);
    }
  }

  _entregar(mano, ts, ms) {
    if (mano && CAMARA.espejo) for (const p of mano) p.x = 1 - p.x;
    this._cuentaFrames++;
    const ahora = performance.now();
    this.stats.ms = this.stats.ms * 0.8 + ms * 0.2;
    if (ahora - this._t0 >= 1000) {
      this.stats.fps = Math.round(this._cuentaFrames * 1000 / (ahora - this._t0));
      this._cuentaFrames = 0;
      this._t0 = ahora;
    }
    this.alResultado(mano, ahora);
  }

  arrancar() {
    this.activo = true;
    const v = this.video;
    const usarRVFC = typeof v.requestVideoFrameCallback === 'function';
    let ultimoTiempoVideo = -1;

    const tic = async () => {
      if (!this.activo) return;
      programar();
      if (this.ocupado || v.readyState < 2) return;
      if (!usarRVFC) {
        if (v.currentTime === ultimoTiempoVideo) return; // sin frame nuevo
        ultimoTiempoVideo = v.currentTime;
      }
      const ts = Math.round(performance.now());
      this.ocupado = true;
      if (this.modo === 'worker') {
        try {
          const imagen = await createImageBitmap(v);
          this.worker.postMessage({ tipo: 'frame', imagen, ts }, [imagen]);
        } catch (e) {
          this.ocupado = false;
        }
      } else {
        const t0 = performance.now();
        let mano = null;
        try { mano = this.detector.detectar(v, ts); } catch (e) { console.warn(e); }
        this.ocupado = false;
        this._entregar(mano, ts, performance.now() - t0);
      }
    };
    const programar = () => usarRVFC ? v.requestVideoFrameCallback(tic) : requestAnimationFrame(tic);
    programar();
  }

  detener() {
    this.activo = false;
    this.worker?.terminate();
    this.detector?.cerrar();
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
