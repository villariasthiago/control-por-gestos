// Puente gestos → emulador. Reemplaza a pynput: en vez de inyectar teclas al sistema
// operativo, escribe directo en el joypad virtual de libretro (simulateInput).
// Ventaja: no depende del foco de la ventana ni del layout del teclado, y no hay
// problemas de RetroArch ignorando teclas alfanuméricas.

export class PuenteEmulador {
  constructor() {
    this.estado = new Map();
    this.gm = null;
    this._timers = new Set();
  }

  conectar(emulador) {
    this.gm = emulador?.gameManager || null;
    // Re-aplica lo que ya estuviera apretado antes de que arranque el juego.
    for (const [b, on] of this.estado) if (on) this._enviar(b, 1);
  }

  get listo() { return !!this.gm; }

  _enviar(boton, valor) {
    if (!this.gm) return;
    try { this.gm.simulateInput(0, boton, valor); } catch (e) { /* core no listo */ }
  }

  set(boton, apretado) {
    apretado = !!apretado;
    if ((this.estado.get(boton) || false) === apretado) return; // solo cambios de flanco
    this.estado.set(boton, apretado);
    this._enviar(boton, apretado ? 1 : 0);
  }

  pulso(boton, ms) {
    this.set(boton, true);
    const t = setTimeout(() => { this._timers.delete(t); this.set(boton, false); }, ms);
    this._timers.add(t);
  }

  soltarTodo() {
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
    for (const [b, on] of this.estado) if (on) this.set(b, false);
  }
}
