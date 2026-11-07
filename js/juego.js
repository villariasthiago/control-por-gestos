// Orquestador de la partida: equivale a main.py de cada juego.
// Cámara → MediaPipe → gesto → puente → EmulatorJS, con el HUD encima.
import { JUEGOS, OUTRUN, STARFORCE, CAMARA, BOTON } from './config.js';
import { leerRom } from './roms.js';
import { rutasEmulador } from './rutas.js';
import { SeguidorManos } from './manos.js';
import { PuenteEmulador } from './puente.js';
import { Hud } from './hud.js';
import { crearVolante } from './gestos/volante.js';
import { crearPuntero } from './gestos/puntero.js';
import { crearGestoStart } from './gestos/start.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const juego = JUEGOS[params.get('juego')];
if (!juego) location.replace('index.html');

const ui = {
  titulo: $('#titulo'), estado: $('#estado'), portada: $('#portada'),
  btnJugar: $('#btn-jugar'), video: $('#video'), hud: $('#hud'),
  escenario: $('#escenario'), aviso: $('#aviso'),
};

const puente = new PuenteEmulador();
const hud = new Hud(ui.hud);
const procesarGesto = juego.gesto === 'volante'
  ? crearVolante(OUTRUN)
  : crearPuntero(STARFORCE, CAMARA);
const procesarStart = crearGestoStart();

let estadoGesto = procesarGesto(null, 0);
let estadoStart = { progreso: 0 };
let ultimaMano = null;
let ultimoResultado = 0;
let verCamara = true, verHud = true;
let fuego = { on: false, t: 0 };
let seguidor = null;

document.title = `${juego.titulo} · Control por gestos`;
ui.titulo.textContent = `${juego.titulo} — ${juego.sistema}`;
$('#instrucciones').innerHTML = juego.instrucciones
  .concat([['👌', 'Gesto OK sostenido', 'START']])
  .map(([ico, gesto, efecto]) => `<li><span class="ico">${ico}</span><b>${gesto}</b><span>${efecto}</span></li>`)
  .join('');

function estado(texto, tipo = 'info') {
  ui.estado.textContent = texto || '';
  ui.estado.dataset.tipo = tipo;
  ui.estado.hidden = !texto;
}
function aviso(texto) { ui.aviso.textContent = texto; ui.aviso.hidden = !texto; }

// ---------- Gestos → botones ----------
function aplicar(e) {
  if (juego.gesto === 'volante') {
    const b = OUTRUN.botones;
    puente.set(b.izq, e.izq);
    puente.set(b.der, e.der);
    puente.set(b.acelerar, e.acelerar);
    if (e.marcha) puente.pulso(b.marcha, OUTRUN.pulsoMarchaMs);
  } else {
    const b = STARFORCE.botones;
    puente.set(b.arriba, e.arriba);
    puente.set(b.abajo, e.abajo);
    puente.set(b.izq, e.izq);
    puente.set(b.der, e.der);
    // El disparo en ráfaga lo maneja el bucle de 60 FPS (tick), no la cámara.
  }
}

function alResultado(mano, ahora) {
  ultimaMano = mano;
  ultimoResultado = ahora;
  estadoGesto = procesarGesto(mano, ahora);
  estadoStart = procesarStart(mano, ahora);
  aplicar(estadoGesto);
  if (estadoStart.disparar) puente.pulso(BOTON.START, 150);
}

// ---------- Bucle visual + autofire a la tasa del monitor ----------
function tick(ahora) {
  requestAnimationFrame(tick);

  // Watchdog: si la detección se colgó (pestaña en segundo plano, cámara desconectada),
  // la tratamos como "sin mano" para no dejar botones trabados.
  if (ultimoResultado > 0 && ahora - ultimoResultado > 500) {
    estadoGesto = procesarGesto(null, ahora);
    aplicar(estadoGesto);
    ultimaMano = null;
  }

  if (juego.gesto === 'puntero') {
    const b = STARFORCE.botones.disparo;
    if (estadoGesto.disparar) {
      if (ahora - fuego.t >= STARFORCE.cadenciaMs) {
        fuego.on = !fuego.on; fuego.t = ahora;
        for (const k of b) puente.set(k, fuego.on);
      }
    } else if (fuego.on) {
      fuego.on = false;
      for (const k of b) puente.set(k, false);
    }
  }

  hud.limpiar();
  if (verHud && seguidor) {
    if (juego.gesto === 'volante') hud.volante(estadoGesto);
    else hud.puntero(estadoGesto, fuego.on);
    if (estadoStart.progreso > 0) dibujarStart(estadoStart.progreso);
    const s = seguidor.stats;
    hud.telemetria(`manos ${s.fps} fps · ${s.ms.toFixed(1)} ms · ${s.delegado} · ${seguidor.modo || '-'} · ${s.origen}`);
  }
  if (seguidor) hud.camara(ui.video, ultimaMano, verCamara);
}

function dibujarStart(p) {
  const ctx = hud.ctx, x = hud.w / 2, y = hud.h / 2;
  ctx.strokeStyle = '#FFB300'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#FFB300'; ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('START', x, y);
}

// ---------- Emulador ----------
async function cargarEmulador(rom) {
  const rutas = await rutasEmulador();
  const url = URL.createObjectURL(new Blob([rom.datos]));
  Object.assign(window, {
    EJS_player: '#juego',
    EJS_core: juego.core,
    EJS_gameUrl: url,
    EJS_gameName: `${juego.id}-${rom.nombre.replace(/\.[^.]+$/, '')}`,
    EJS_pathtodata: rutas.data,
    EJS_DEBUG_XX: rutas.debug,
    EJS_startOnLoaded: true,
    EJS_language: 'es-ES',
    EJS_color: '#00E5FF',
    EJS_backgroundColor: '#000',
    EJS_threads: false,
    EJS_volume: 0.6,
    EJS_Buttons: {
      netplay: false, cheat: false, exitEmulation: false, diskButton: false,
      screenRecord: false, cacheManager: false, fullscreen: false,
    },
    EJS_onGameStart: () => {
      puente.conectar(window.EJS_emulator);
      estado(null);
    },
  });
  const s = document.createElement('script');
  s.src = rutas.data + 'loader.js';
  s.onerror = () => estado('No se pudo cargar el emulador. Revisá la conexión.', 'error');
  document.body.appendChild(s);
}

async function iniciar() {
  ui.portada.hidden = true;
  estado('Cargando…');

  const rom = await leerRom(juego.id);
  if (!rom) { location.replace(`index.html?falta=${juego.id}`); return; }

  // Emulador y cámara en paralelo: el que tarde más define cuándo se juega.
  const emu = cargarEmulador(rom).catch((e) => estado(`Error del emulador: ${e.message}`, 'error'));

  seguidor = new SeguidorManos({ video: ui.video, alResultado, alEstado: (t) => t && estado(t) });
  try {
    await seguidor.iniciarCamara();
    await seguidor.iniciarDetector();
    seguidor.arrancar();
  } catch (e) {
    console.error(e);
    seguidor = null;
    const negado = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    aviso(negado
      ? 'Sin permiso de cámara: se juega con el teclado. Habilitala en el candado de la barra de direcciones y recargá.'
      : `No se pudo iniciar el control por gestos (${e.message || e}). Se juega con el teclado.`);
  }
  await emu;
  requestAnimationFrame(tick);
}

// ---------- Controles de la página ----------
ui.btnJugar.addEventListener('click', iniciar, { once: true });
$('#btn-start').addEventListener('click', () => puente.pulso(BOTON.START, 150));
$('#btn-camara').addEventListener('click', (e) => { verCamara = !verCamara; e.currentTarget.classList.toggle('apagado', !verCamara); });
$('#btn-hud').addEventListener('click', (e) => { verHud = !verHud; e.currentTarget.classList.toggle('apagado', !verHud); });
$('#btn-pantalla').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else ui.escenario.requestFullscreen?.({ navigationUI: 'hide' });
});

document.addEventListener('visibilitychange', () => { if (document.hidden) puente.soltarTodo(); });
window.addEventListener('blur', () => puente.soltarTodo());
window.addEventListener('keydown', (e) => {
  // Cierre global limpio (antes: listener de pynput con q / Esc).
  if (e.key === 'Escape' && !document.fullscreenElement) location.href = 'index.html';
});
window.addEventListener('pagehide', () => { puente.soltarTodo(); seguidor?.detener(); });

// juego.html?juego=...&debug → expone ganchos para probar sin cámara desde la consola.
if (params.has('debug')) {
  window.__gestos = {
    inyectar: (mano) => alResultado(mano && mano.map((p) => ({ ...p })), performance.now()),
    estado: () => ({ gesto: estadoGesto, botones: Object.fromEntries(puente.estado), stats: seguidor?.stats, modo: seguidor?.modo }),
    puente,
    congelarCamara: () => { if (seguidor) seguidor.activo = false; },
  };
}
