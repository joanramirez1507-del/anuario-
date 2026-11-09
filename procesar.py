#!/usr/bin/env python3
"""Empareja fotos/firmas descargadas de Drive con cada estudiante y limpia las firmas.

Uso:  1) Descarga las carpetas de respuestas del formulario y pon las fotos en  fotos/  y las firmas en  firmas/
         (los archivos de Drive terminan en " - Nombre del estudiante.ext"; no hace falta renombrarlos).
      2) python procesar.py        (para limpiar firmas: pip install pillow)
      3) Abre el anuario con:  python -m http.server   ->  http://localhost:8000
"""
import json, re, os, unicodedata
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    Image = None

AQUI = Path(__file__).parent
EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}
norm = lambda s: re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()).split()

txt = (AQUI / 'data.js').read_text(encoding='utf-8')
estudiantes = json.loads(txt[txt.index('['):txt.rindex(']') + 1])

def listar(carpeta):
    d = AQUI / carpeta
    return [f for f in sorted(d.glob('*')) if f.suffix.lower() in EXT] if d.exists() else []

def buscar(nombre, archivos, usados):
    tokens = norm(nombre); mejor, mp = None, 0
    for f in archivos:
        if f in usados: continue
        cola = set(norm(f.stem.split(' - ')[-1]))        # parte del nombre del estudiante
        pts = sum(t in cola for t in tokens) / len(tokens)
        if pts > mp or (pts == mp and mejor and f.stat().st_mtime > mejor.stat().st_mtime): mejor, mp = f, pts
    return mejor if mp >= .75 else None

def limpiar(src, dst):
    im = Image.open(src).convert('RGBA'); im.thumbnail((1400, 1400))
    w, h = im.size; px = im.load(); k = max(2, int(min(w, h) * .03))
    esq = [px[x, y] for cx, cy in ((0, 0), (w - k, 0), (0, h - k), (w - k, h - k)) for x in range(cx, cx + k) for y in range(cy, cy + k)]
    A = sum(p[3] for p in esq) / len(esq); lum = lambda p: .299 * p[0] + .587 * p[1] + .114 * p[2]
    L = sum(lum(p) for p in esq) / len(esq); transp = A < 40; oscuro = not transp and L < 110
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); po = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if transp: a = p[3]; col = p[:3]
            else:
                s = (lum(p) - L) / (255 - L) if oscuro else (L - lum(p)) / max(L, 1)
                a = 0 if s < .12 else min(255, int(s * 360)); col = (14, 28, 70)
            po[x, y] = (*col, a)
    caja = out.getchannel('A').point(lambda v: 255 if v > 70 else 0).getbbox()
    if not caja: return False
    pad_x, pad_y = int((caja[2] - caja[0]) * .05) + 2, int((caja[3] - caja[1]) * .1) + 2
    caja = (max(0, caja[0] - pad_x), max(0, caja[1] - pad_y), min(w, caja[2] + pad_x), min(h, caja[3] + pad_y))
    out.crop(caja).save(dst); return True

fotos, firmas = listar('fotos'), listar('firmas')
(AQUI / 'firmas_limpias').mkdir(exist_ok=True)
res, uf, us = {}, set(), set()
for i, e in enumerate(estudiantes, 1):
    r = {}
    f = buscar(e['nombre'], fotos, uf)
    if f: uf.add(f); r['foto'] = f'fotos/{f.name}'
    s = buscar(e['nombre'], firmas, us)
    if s:
        us.add(s); r['firma'] = f'firmas/{s.name}'
        if Image:
            dst = AQUI / 'firmas_limpias' / f'{i:02d}.png'
            try:
                if limpiar(s, dst): r['firma'] = f'firmas_limpias/{dst.name}'
            except Exception as ex: print('  (no se pudo limpiar)', s.name, ex)
    res[e['nombre']] = r
    print(f"{i:2d}. {e['nombre']:<38} foto: {'OK' if 'foto' in r else '— falta'}   firma: {'OK' if 'firma' in r else '— falta'}")
if not Image: print('\nAviso: instala Pillow (pip install pillow) para limpiar las firmas automáticamente.')
(AQUI / 'archivos.js').write_text('const ARCHIVOS = ' + json.dumps(res, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
print('\nListo: archivos.js actualizado. Lo que falte se carga desde Drive.')