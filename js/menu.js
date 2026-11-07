// Menú principal: carga y validación de ROMs locales.
import { JUEGOS } from './config.js';
import { guardarRom, leerRom, borrarRom, validarRom } from './roms.js';

const contenedor = document.getElementById('juegos');
const tpl = document.getElementById('tpl-juego');
const mensaje = document.getElementById('mensaje');

const falta = new URLSearchParams(location.search).get('falta');
if (falta && JUEGOS[falta]) {
  mensaje.textContent = `Para jugar ${JUEGOS[falta].titulo} primero cargá su ROM.`;
  mensaje.hidden = false;
}

const kb = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

for (const juego of Object.values(JUEGOS)) {
  const nodo = tpl.content.firstElementChild.cloneNode(true);
  const $ = (s) => nodo.querySelector(s);
  nodo.dataset.juego = juego.id;
  $('.juego-titulo').textContent = juego.titulo;
  $('.juego-sistema').textContent = juego.sistema;
  $('.juego-gestos').innerHTML = juego.instrucciones
    .map(([ico, g, ef]) => `<li><span class="ico">${ico}</span>${g} → <b>${ef}</b></li>`).join('');

  const input = $('.rom-input');
  input.accept = juego.extensiones.join(',');
  const jugar = $('.juego-jugar');
  const avisoEl = $('.rom-aviso');

  function pintar(rom, avisoTexto, esError) {
    $('.rom-estado').textContent = rom ? `✔ ${rom.nombre} (${kb(rom.tamano)})` : 'Sin ROM cargada';
    $('.rom-estado').classList.toggle('ok', !!rom);
    $('.rom-borrar').hidden = !rom;
    avisoEl.hidden = !avisoTexto;
    avisoEl.textContent = avisoTexto || '';
    avisoEl.classList.toggle('error', !!esError);
    if (rom) { jugar.href = `juego.html?juego=${juego.id}`; jugar.removeAttribute('aria-disabled'); }
    else { jugar.removeAttribute('href'); jugar.setAttribute('aria-disabled', 'true'); }
  }

  input.addEventListener('change', async () => {
    const archivo = input.files[0];
    input.value = '';
    if (!archivo) return;
    if (archivo.size > 16 * 1048576) { pintar(null, 'El archivo es demasiado grande para ser esta ROM.', true); return; }
    const datos = await archivo.arrayBuffer();
    const v = validarRom(juego.id, datos, archivo.name);
    if (!v.ok) { pintar(await leerRom(juego.id).catch(() => null), v.error, true); return; }
    const registro = { nombre: archivo.name, tamano: archivo.size, fecha: Date.now(), datos };
    try {
      await guardarRom(juego.id, registro);
      pintar(registro, v.aviso);
    } catch (e) {
      pintar(null, `No se pudo guardar en el navegador (${e.message}). ¿Modo incógnito?`, true);
    }
  });

  $('.rom-borrar').addEventListener('click', async () => { await borrarRom(juego.id); pintar(null); });

  leerRom(juego.id).then((rom) => pintar(rom), () => pintar(null, 'Este navegador no permite guardar datos locales.', true));
  contenedor.appendChild(nodo);
}
