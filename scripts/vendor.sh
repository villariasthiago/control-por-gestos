#!/usr/bin/env bash
# Descarga las dependencias a vendor/ para que el sitio no dependa de CDNs de terceros.
# Lo corre GitHub Actions en cada deploy. En local: bash scripts/vendor.sh
# No descarga ROMs: el sitio no las incluye ni las distribuye.
set -euo pipefail

EJS_VER="4.2.3"
MP_VER="0.10.35"
MODELO_URL="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
CORES=(genesis_plus_gx fceumm)   # Mega Drive (OutRun) y NES (Star Force)

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$RAIZ/vendor"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

desempacar() { # paquete@version destino
  (cd "$TMP" && npm pack "$1" --silent >/dev/null)
  local tgz; tgz="$(ls -t "$TMP"/*.tgz | head -1)"
  mkdir -p "$2"; tar xzf "$tgz" -C "$2" --strip-components=1; rm "$tgz"
}

echo "→ EmulatorJS $EJS_VER"
desempacar "@emulatorjs/emulatorjs@$EJS_VER" "$TMP/ejs"
DATA="$VENDOR/emulatorjs/data"
rm -rf "$VENDOR/emulatorjs"; mkdir -p "$DATA/cores/reports"
cp -r "$TMP/ejs/data/"{loader.js,emulator.css,version.json,src,compression,localization} "$DATA/"
cp "$TMP/ejs/LICENSE" "$VENDOR/emulatorjs/LICENSE"

for core in "${CORES[@]}"; do
  echo "→ core $core"
  desempacar "@emulatorjs/core-$core@$EJS_VER" "$TMP/core-$core"
  # Sin variantes -thread: GitHub Pages no manda los headers COOP/COEP que requieren.
  cp "$TMP/core-$core/$core-wasm.data" "$TMP/core-$core/$core-legacy-wasm.data" "$DATA/cores/"
  cp "$TMP/core-$core/reports/$core.json" "$DATA/cores/reports/"
done

echo "→ MediaPipe Tasks Vision $MP_VER"
desempacar "@mediapipe/tasks-vision@$MP_VER" "$TMP/mp"
rm -rf "$VENDOR/mediapipe"; mkdir -p "$VENDOR/mediapipe/wasm"
cp "$TMP/mp/vision_bundle.mjs" "$VENDOR/mediapipe/"
cp "$TMP/mp/wasm/"vision_wasm_{internal,module_internal,nosimd_internal}.{js,wasm} "$VENDOR/mediapipe/wasm/"

echo "→ Modelo hand_landmarker"
mkdir -p "$VENDOR/modelos"
if [ ! -s "$VENDOR/modelos/hand_landmarker.task" ]; then
  if ! curl -fsSL "$MODELO_URL" -o "$VENDOR/modelos/hand_landmarker.task.tmp"; then
    rm -f "$VENDOR/modelos/hand_landmarker.task.tmp"
    echo "  ! No se pudo bajar el modelo: el sitio lo cargará desde el CDN de Google."
  else
    mv "$VENDOR/modelos/hand_landmarker.task.tmp" "$VENDOR/modelos/hand_landmarker.task"
  fi
fi

du -sh "$VENDOR"/* 2>/dev/null
echo "✔ vendor/ listo"
