// Núcleo compartido del detector: corre igual en un Web Worker o en el hilo principal.

export async function crearDetector({ bundle, wasm, modelo, opciones, enWorker }) {
  const { FilesetResolver, HandLandmarker } = await import(bundle);
  // En module workers no hay importScripts: se usa la variante ES module del wasm.
  const fileset = await FilesetResolver.forVisionTasks(wasm, enWorker);

  const base = {
    runningMode: 'VIDEO',
    numHands: opciones.maxManos,
    minHandDetectionConfidence: opciones.confDeteccion,
    minHandPresenceConfidence: opciones.confPresencia,
    minTrackingConfidence: opciones.confSeguimiento,
  };

  let landmarker, delegado = opciones.delegado;
  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      ...base, baseOptions: { modelAssetPath: modelo, delegate: delegado },
    });
  } catch (e) {
    if (delegado === 'CPU') throw e;
    delegado = 'CPU';
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      ...base, baseOptions: { modelAssetPath: modelo, delegate: 'CPU' },
    });
  }

  let ultimoTs = -1;
  return {
    delegado,
    detectar(imagen, ts) {
      // MediaPipe exige timestamps estrictamente crecientes.
      if (ts <= ultimoTs) ts = ultimoTs + 1;
      ultimoTs = ts;
      const r = landmarker.detectForVideo(imagen, ts);
      const mano = r.landmarks && r.landmarks[0];
      return mano ? mano.map((p) => ({ x: p.x, y: p.y, z: p.z })) : null;
    },
    cerrar() { landmarker.close(); },
  };
}
