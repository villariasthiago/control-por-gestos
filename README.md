# Control por gestos: OutRun y Star Force en el navegador

Versión web del proyecto de control por gestos presentado en la jornada de puertas abiertas.
Antes hacía falta Python, OpenCV, PyQt5, pynput y RetroArch instalados. Ahora alcanza con abrir un link en Chrome.

- **OutRun** (Sega Mega Drive): volante virtual con la inclinación de la mano, palma abierta para acelerar y puño para cambiar la marcha.
- **Star Force** (NES): el índice como puntero, con zona relativa y continua, autofire doble y modo inercia.
- **👌 Gesto OK sostenido** = START, para pasar los menús sin teclado.

## ROMs

**El repositorio no incluye ni distribuye ROMs.** Cada jugador elige su propio archivo desde el menú.
La ROM se guarda solo en el navegador de esa computadora (IndexedDB) y nunca se sube a ningún servidor.
El workflow de deploy falla a propósito si detecta una ROM en el repo. La detección es por firma binaria,
así que funciona aunque el archivo se llame `.md` como un README.

| Juego | Sistema | Extensiones aceptadas |
|---|---|---|
| OutRun | Mega Drive / Genesis | `.md` `.bin` `.gen` `.smd` `.zip` |
| Star Force | NES | `.nes` `.zip` |

## Publicar en GitHub Pages

1. Subí este proyecto a un repo de GitHub (rama `main`).
2. En el repo, andá a **Settings → Pages → Build and deployment → Source** y elegí **GitHub Actions**.
3. Hacé un push. El workflow verifica que no haya ROMs, corre los tests, descarga EmulatorJS, los cores, MediaPipe y el modelo de manos, y publica el sitio.
4. El sitio queda en `https://<usuario>.github.io/<repo>/`.

GitHub Pages sirve por HTTPS, que es lo que exige el navegador para usar la cámara.

## Correr en local

```bash
bash scripts/vendor.sh        # una vez: baja dependencias a vendor/ (requiere node/npm y curl)
python3 -m http.server 8000   # http://localhost:8000 (localhost también habilita la cámara)
npm test                      # tests de la lógica de gestos
```

Si no corrés `vendor.sh`, el sitio igual funciona cargando todo desde los CDN oficiales.

## Calibración

Todos los umbrales están en `js/config.js` y son los mismos de `config.py` y `config_starforce.py`:

| Parámetro | Valor | Origen |
|---|---|---|
| `anguloIzq` / `anguloDer` | -110° / -70° | `ANGULO_IZQ` / `ANGULO_DER` |
| `ratioPunio` / `ratioPalma` | 1.25 / 1.45 | `RATIO_PUNIO` / `RATIO_PALMA` |
| `pulsoMarchaMs` | 100 | `TIEMPO_PULSO_MARCHA` |
| `zonaX` / `zonaY` | 75 / 60 px | `ZONA_X` / `ZONA_Y` |
| `umbralDelta` | 4 px | `UMBRAL_DELTA` (ahora normalizado por tiempo) |
| `cadenciaMs` | 60 | `CADENCIA_TIC` |

Para probar sin cámara, abrí `juego.html?juego=outrun&debug` y usá `window.__gestos` desde la consola.

## Arquitectura

```
index.html / js/menu.js      Menú, carga y validación de ROMs (cabecera iNES / firma SEGA)
juego.html / js/juego.js     Orquestador (el main.py de antes)
js/manos.js                  Cámara + MediaPipe Hand Landmarker
js/detector.worker.js        MediaPipe en un Web Worker (GPU, con fallback a CPU / hilo principal)
js/gestos/volante.js         Lógica OutRun (función pura, testeada)
js/gestos/puntero.js         Lógica Star Force + modo inercia (función pura, testeada)
js/gestos/start.js           Gesto OK → START
js/puente.js                 Gestos → joypad libretro de EmulatorJS (reemplaza a pynput)
js/hud.js                    HUD de OutRun, radar de Star Force y vista de cámara
```

### Qué cambió respecto de la versión de escritorio

| Escritorio | Web | Ventaja |
|---|---|---|
| OpenCV `VideoCapture` | `getUserMedia` | Sin instalar drivers ni backends por SO |
| MediaPipe Python | MediaPipe Tasks (WASM) en un Worker | No le roba frames ni audio al emulador |
| pynput (teclado del SO) | `simulateInput` del core libretro | Sin problemas de foco ni teclas ignoradas por RetroArch |
| `time.sleep` en el cambio de marcha | `setTimeout` | No congela la detección |
| HUD PyQt5 / tkinter click-through | Canvas con `pointer-events: none` | Mismo resultado sin hacks por SO |
| Conflicto Qt/xcb entre OpenCV y PyQt5 | No existe | — |

## Créditos

- [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS) (GPL-3.0) con los cores Genesis Plus GX y FCEUmm.
- [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0), Hand Landmarker.
- OutRun © SEGA. Star Force © Tecmo / Hudson Soft. Este proyecto no está afiliado a esas empresas.
