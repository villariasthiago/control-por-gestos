// ROMs del usuario. Se guardan SOLO en el navegador (IndexedDB) de quien las carga.
// Nunca se suben a ningún servidor ni al repositorio.

const DB = 'gestos-retro', STORE = 'roms', VERSION = 1;

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, modo);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r && r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export const guardarRom = (juego, registro) => tx('readwrite', (s) => s.put(registro, juego));
export const leerRom = (juego) => tx('readonly', (s) => s.get(juego));
export const borrarRom = (juego) => tx('readwrite', (s) => s.delete(juego));

const ascii = (bytes, ini, fin) =>
  String.fromCharCode(...bytes.subarray(ini, Math.min(fin, bytes.length))).replace(/[^\x20-\x7E]/g, ' ');

// Verificación por cabecera para evitar el clásico "cargué la ROM equivocada".
export function validarRom(juego, buffer, nombre) {
  const b = new Uint8Array(buffer);
  const ext = (nombre.match(/\.[^.]+$/) || [''])[0].toLowerCase();

  if (b.length < 16) return { ok: false, error: 'El archivo está vacío o dañado.' };
  if (b[0] === 0x50 && b[1] === 0x4B) {
    return { ok: true, aviso: 'Archivo .zip: no se puede verificar el contenido antes de abrirlo.' };
  }

  if (juego === 'starforce') {
    const esNes = b[0] === 0x4E && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1A;
    if (!esNes) return { ok: false, error: 'No es una ROM de NES (falta la cabecera iNES).' };
    if (!/star.?force/i.test(nombre)) {
      return { ok: true, aviso: 'Es una ROM de NES válida, pero el nombre no dice "Star Force". Verificá que sea el juego correcto.' };
    }
    return { ok: true };
  }

  if (juego === 'outrun') {
    let cab = ascii(b, 0x100, 0x200);
    let smd = false;
    if (!/SEGA/.test(cab.slice(0, 16)) && ext === '.smd' && b.length % 16384 === 512) {
      smd = true; // formato SMD intercalado: el core lo convierte solo
    }
    if (!smd && !/SEGA/.test(cab.slice(0, 16))) {
      return { ok: false, error: 'No es una ROM de Mega Drive / Genesis (falta la firma SEGA).' };
    }
    if (smd) return { ok: true, aviso: 'Formato SMD detectado: no se puede verificar el título.' };
    const titulo = cab.slice(0x20, 0x80).replace(/\s+/g, '');
    if (!/OUT\s*RUN/i.test(titulo)) {
      return { ok: true, aviso: `Es una ROM de Mega Drive, pero el título interno es "${cab.slice(0x50, 0x80).trim()}". ¿Es OutRun?` };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Juego desconocido.' };
}
