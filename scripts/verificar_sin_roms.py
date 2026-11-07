#!/usr/bin/env python3
"""Corta el deploy si alguien sube una ROM al repo por error.

Busca firmas binarias (no extensiones: tu ROM de OutRun se llama .md, igual que un README):
  - NES:        'NES\\x1A' en el byte 0
  - Mega Drive: 'SEGA' en el offset 0x100
"""
import subprocess
import sys

archivos = subprocess.run(["git", "ls-files", "-z"], capture_output=True, check=True).stdout.split(b"\0")
encontrados = []
for nombre in filter(None, archivos):
    ruta = nombre.decode()
    try:
        with open(ruta, "rb") as f:
            cab = f.read(0x110)
    except (IsADirectoryError, FileNotFoundError):
        continue
    if cab[:4] == b"NES\x1a":
        encontrados.append((ruta, "ROM de NES"))
    elif len(cab) >= 0x104 and cab[0x100:0x104] == b"SEGA":
        encontrados.append((ruta, "ROM de Mega Drive"))

if encontrados:
    print("✖ Hay ROMs en el repositorio. Sacalas antes de publicar (git rm --cached <archivo>):")
    for ruta, tipo in encontrados:
        print(f"   - {ruta}  ({tipo})")
    sys.exit(1)
print("✔ Sin ROMs en el repositorio")
