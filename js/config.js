// Configuración central. Portada 1:1 de outrun/config.py y starforce/config_starforce.py.
// Todo lo que haya que calibrar en el stand se toca acá.

export const VERSIONES = {
  emulatorjs: '4.2.3',
  mediapipe: '0.10.35',
};

// Índices RetroPad (libretro) que entiende EmulatorJS en simulateInput().
export const BOTON = {
  B: 0, Y: 1, SELECT: 2, START: 3,
  ARRIBA: 4, ABAJO: 5, IZQ: 6, DER: 7,
  A: 8, X: 9, L: 10, R: 11,
};

export const CAMARA = {
  ancho: 640,          // CAM_ANCHO
  alto: 480,           // CAM_ALTO
  espejo: true,        // equivalente a cv2.flip(frame, 1)
};

export const DETECCION = {
  maxManos: 1,
  confDeteccion: 0.7,  // min_detection_confidence
  confPresencia: 0.7,
  confSeguimiento: 0.7, // min_tracking_confidence
  delegado: 'GPU',     // si falla, cae solo a CPU
};

export const OUTRUN = {
  anguloIzq: -110,      // ANGULO_IZQ
  anguloDer: -70,       // ANGULO_DER
  ratioPunio: 1.25,     // RATIO_PUNIO
  ratioPalma: 1.45,     // RATIO_PALMA
  pulsoMarchaMs: 100,   // TIEMPO_PULSO_MARCHA (sin bloquear el hilo, a diferencia de time.sleep)
  graciaSinManoMs: 150, // tolerancia a pérdidas de tracking de 1-4 frames
  // En RetroArch usabas z = RetroPad B (acelerar) y x = RetroPad A (cambio).
  botones: { izq: BOTON.IZQ, der: BOTON.DER, acelerar: BOTON.B, marcha: BOTON.A },
  colores: { fondo: 'rgba(17,17,17,0.75)', centro: '#00E5FF', giro: '#00FF66', accion: '#FFB300' },
};

export const STARFORCE = {
  zonaX: 75,            // ZONA_X (px sobre cámara 640x480)
  zonaY: 60,            // ZONA_Y
  umbralDelta: 4,       // UMBRAL_DELTA (px por frame a ~30 FPS; se normaliza por tiempo)
  cadenciaMs: 60,       // CADENCIA_TIC
  graciaSinManoMs: 300, // Modo Inercia: mantiene dirección y disparo si se pierde la mano
  botones: {
    arriba: BOTON.ARRIBA, abajo: BOTON.ABAJO, izq: BOTON.IZQ, der: BOTON.DER,
    disparo: [BOTON.B, BOTON.A], // TECLAS_DISPARO = ['z', 'x']
  },
  colores: {
    radar: '#00E5FF', zona: '#00FF66', vector: '#FFFF00', puntero: '#FF0055', texto: '#FFFFFF',
  },
};

export const JUEGOS = {
  outrun: {
    id: 'outrun',
    titulo: 'OutRun',
    sistema: 'Sega Mega Drive',
    core: 'segaMD',
    extensiones: ['.md', '.bin', '.gen', '.smd', '.zip'],
    gesto: 'volante',
    instrucciones: [
      ['🛞', 'Inclinar la mano', 'gira el auto'],
      ['✋', 'Palma abierta', 'acelera'],
      ['✊', 'Puño cerrado', 'cambia de marcha'],
    ],
  },
  starforce: {
    id: 'starforce',
    titulo: 'Star Force',
    sistema: 'Nintendo NES',
    core: 'nes',
    extensiones: ['.nes', '.zip'],
    gesto: 'puntero',
    instrucciones: [
      ['☝️', 'Mover el índice', 'mueve la nave'],
      ['🎯', 'Cuadro central', 'movimiento fino'],
      ['🔫', 'Mano a la vista', 'dispara solo'],
    ],
  },
};
