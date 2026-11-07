// Gesto extra para la web: "OK" (pulgar + índice tocándose, resto de dedos estirados)
// sostenido un momento = botón START. Así los chicos pasan los menús del juego sin teclado.

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function esGestoOk(mano) {
  const escala = d(mano[0], mano[9]);            // muñeca → base del medio
  if (escala <= 0) return false;
  const pinza = d(mano[4], mano[8]) < 0.35 * escala;
  const estirado = (punta, pip) => d(mano[0], mano[punta]) > d(mano[0], mano[pip]) * 1.15;
  return pinza && estirado(12, 10) && estirado(16, 14) && estirado(20, 18);
}

export function crearGestoStart({ sostenerMs = 800, enfriamientoMs = 1500 } = {}) {
  let desde = null, ultimoDisparo = -Infinity;
  return function procesar(mano, ahora) {
    const ok = !!mano && esGestoOk(mano);
    if (!ok) { desde = null; return { progreso: 0, disparar: false }; }
    if (ahora - ultimoDisparo < enfriamientoMs) return { progreso: 1, disparar: false };
    if (desde === null) desde = ahora;
    const progreso = Math.min(1, (ahora - desde) / sostenerMs);
    if (progreso >= 1) { ultimoDisparo = ahora; desde = null; return { progreso: 1, disparar: true }; }
    return { progreso, disparar: false };
  };
}
