// HUDs superpuestos. Port visual de outrun/interfaz_hud.py (PyQt5) y
// starforce/interfaz_hud.py (radar tkinter). Acá no hace falta click-through a nivel
// sistema operativo: el canvas tiene pointer-events: none y el emulador nunca pierde el foco.
import { CAMARA, OUTRUN, STARFORCE } from './config.js';

const CONEXIONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export class Hud {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    new ResizeObserver(() => this._ajustar()).observe(canvas);
    this._ajustar();
  }

  _ajustar() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.c.width = Math.max(1, Math.round(r.width * this.dpr));
    this.c.height = Math.max(1, Math.round(r.height * this.dpr));
  }

  limpiar() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  // ---------- OutRun: caja central superior ----------
  volante(e) {
    const ctx = this.ctx, col = OUTRUN.colores;
    const ancho = Math.min(480, this.w - 20), alto = 78;
    const x = (this.w - ancho) / 2, y = 18;

    ctx.fillStyle = col.fondo;
    redondeado(ctx, x, y, ancho, alto, 12); ctx.fill();

    let texto = '──  CENTRO  ──', color = col.centro;
    if (e.direccion === 'IZQUIERDA') { texto = '<<<  IZQUIERDA'; color = col.giro; }
    else if (e.direccion === 'DERECHA') { texto = 'DERECHA  >>>'; color = col.giro; }
    if (!e.conMano && !e.inercia) { texto = 'MOSTRÁ LA MANO'; color = '#888'; }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(Math.min(32, ancho / 13))}px Impact, "DejaVu Sans", sans-serif`;
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillText(texto, this.w / 2, y + 30);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 16px "DejaVu Sans", sans-serif';
    ctx.fillStyle = col.accion;
    ctx.fillText(e.inercia ? `${e.accion} · RECUPERANDO` : e.accion, this.w / 2, y + 60);

    // Indicador analógico del ángulo de la muñeca, con la zona muerta marcada.
    const bx = x + 24, bw = ancho - 48, by = y + alto - 6;
    const norm = (a) => Math.max(0, Math.min(1, (a + 150) / 120)); // -150°..-30°
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = 'rgba(0,229,255,0.35)';
    const z0 = norm(OUTRUN.anguloIzq), z1 = norm(OUTRUN.anguloDer);
    ctx.fillRect(bx + bw * z0, by, bw * (z1 - z0), 3);
    if (e.conMano) {
      ctx.fillStyle = color;
      ctx.fillRect(bx + bw * norm(e.angulo) - 3, by - 3, 6, 9);
    }
  }

  // ---------- Star Force: radar vectorial ----------
  puntero(e, disparando) {
    const ctx = this.ctx, col = STARFORCE.colores;
    const R = 72, cx = this.w - R - 30, cy = R + 30;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    redondeado(ctx, cx - R - 18, cy - R - 18, 2 * R + 36, 2 * R + 92, 14); ctx.fill();

    ctx.strokeStyle = col.radar; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx - R - 5, cy); ctx.lineTo(cx + R + 5, cy);
    ctx.moveTo(cx, cy - R - 5); ctx.lineTo(cx, cy + R + 5);
    ctx.stroke();

    const ex = R / (CAMARA.ancho / 2), ey = R / (CAMARA.alto / 2);
    ctx.strokeStyle = col.zona; ctx.setLineDash([2, 2]);
    ctx.strokeRect(cx - STARFORCE.zonaX * ex, cy - STARFORCE.zonaY * ey, 2 * STARFORCE.zonaX * ex, 2 * STARFORCE.zonaY * ey);
    ctx.setLineDash([]);

    if (e.dedo) {
      let px = cx + (e.dedo.x - CAMARA.ancho / 2) * ex;
      let py = cy + (e.dedo.y - CAMARA.alto / 2) * ey;
      const d = Math.hypot(px - cx, py - cy);
      if (d > R) { px = cx + (px - cx) * R / d; py = cy + (py - cy) * R / d; }
      if (d > 6) flecha(ctx, cx, cy, px, py, col.vector);
      ctx.fillStyle = e.dentro ? col.zona : col.puntero;
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Arial, sans-serif'; ctx.fillStyle = col.texto;
    ctx.fillText(`DIR: ${e.estado || 'NEUTRO'}`, cx, cy + R + 22);
    ctx.font = '12px Arial, sans-serif'; ctx.fillStyle = e.inercia ? '#FFB300' : col.radar;
    ctx.fillText(e.modo, cx, cy + R + 42);
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = e.disparar ? '#FF0033' : '#777';
    ctx.fillText(e.disparar ? (disparando ? '● DISPARANDO' : '○ DISPARANDO') : '○ ESPERANDO MANO', cx, cy + R + 60);
  }

  // ---------- Vista de cámara con el esqueleto de la mano ----------
  camara(video, mano, visible) {
    if (!visible || !video.videoWidth) return;
    const ctx = this.ctx;
    const w = Math.min(220, this.w * 0.28), h = w * video.videoHeight / video.videoWidth;
    const x = 14, y = this.h - h - 60; // por encima de la barra de EmulatorJS

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.translate(x + w, y); ctx.scale(-1, 1); // espejo, como cv2.flip
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,229,255,0.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    if (!mano) return;
    ctx.strokeStyle = '#00FF66'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b] of CONEXIONES) {
      ctx.moveTo(x + mano[a].x * w, y + mano[a].y * h);
      ctx.lineTo(x + mano[b].x * w, y + mano[b].y * h);
    }
    ctx.stroke();
    ctx.fillStyle = '#FF0055';
    for (const p of mano) { ctx.beginPath(); ctx.arc(x + p.x * w, y + p.y * h, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }

  telemetria(texto) {
    const ctx = this.ctx;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(texto, 10, 8);
  }
}

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function flecha(ctx, x0, y0, x1, y1, color) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
}
