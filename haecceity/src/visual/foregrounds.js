/**
 * Popping X/Y Coordinate Reticle Overlay
 * Renders on top of the real multi-pass WebGL2 Haecceity shader pipeline:
 *  - Full-viewport axis hairlines & graduation ticks
 *  - Rotating phosphor/coral corner brackets & live audio-waveform orbital halo
 *  - Expanding kick shockwave rings & fading drag trail
 *  - Crisp floating Departure Mono telemetry tag
 */

export class CoordinateOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.startTime = performance.now();

    this.x = 0.48;
    this.y = 0.52;
    this.dragging = false;
    this.dragEnergy = 0;
    this.trail = [];
    this.shockwaves = [];
    this.lastKickPeak = 0;

    this.telemetry = {
      kickEnv: 0,
      peakKick: 0,
      peakIdm: 0,
      idmMode: 'NORMAL',
      scope: [],
    };
    this.bpm = 148;
    this.palette = { b: [0.28, 0.85, 0.92], accent: [0.95, 0.92, 0.20] };
  }

  setState({ x, y, dragging, bpm, palette }) {
    if (typeof x === 'number' && typeof y === 'number') {
      if (dragging && (Math.abs(x - this.x) > 0.002 || Math.abs(y - this.y) > 0.002)) {
        this.trail.push({ x, y, age: 0 });
        if (this.trail.length > 26) this.trail.shift();
      }
      this.x = x;
      this.y = y;
    }
    if (typeof dragging === 'boolean') {
      this.dragging = dragging;
      if (dragging) this.dragEnergy = 1.0;
    }
    if (typeof bpm === 'number') this.bpm = bpm;
    if (palette) this.palette = palette;
  }

  updateTelemetry(t) {
    this.telemetry = t;
    if ((t.peakKick || 0) > 0.35 && this.lastKickPeak <= 0.35) {
      this.shockwaves.push({ x: this.x, y: this.y, r: 10, maxR: 240 + t.peakKick * 180, alpha: 0.9 });
    }
    this.lastKickPeak = t.peakKick || 0;
  }

  colCss(rgb, a = 1) {
    return `rgba(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}, ${a})`;
  }

  render() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(200, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    ctx.clearRect(0, 0, vw, vh);

    const t = (performance.now() - this.startTime) / 1000;
    this.dragEnergy *= 0.93;

    const cx = this.x * vw;
    const cy = (1 - this.y) * vh;
    const kick = this.telemetry.kickEnv || 0;
    const idm = this.telemetry.peakIdm || 0;
    const accent = this.colCss(this.palette.accent, 0.95);
    const main = this.colCss(this.palette.b, 0.95);

    // 1. Axis hairlines with tick graduations
    ctx.strokeStyle = this.dragging ? 'rgba(255, 84, 54, 0.65)' : 'rgba(150, 247, 190, 0.34)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, vh);
    ctx.moveTo(0, cy); ctx.lineTo(vw, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(232, 237, 233, 0.42)';
    for (let i = 1; i < 16; i++) {
      const tx = (i / 16) * vw;
      ctx.beginPath(); ctx.moveTo(tx, cy - 4); ctx.lineTo(tx, cy + 4); ctx.stroke();
      const ty = (i / 16) * vh;
      ctx.beginPath(); ctx.moveTo(cx - 4, ty); ctx.lineTo(cx + 4, ty); ctx.stroke();
    }

    // 2. Fading coordinate drag trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const pt = this.trail[i];
      pt.age += 0.04;
      if (pt.age >= 1) {
        this.trail.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(255, 110, 75, ${(1 - pt.age) * 0.72})`;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(pt.x * vw - 3, (1 - pt.y) * vh - 3, 6, 6);
    }

    // 3. Kick shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.r += 9;
      sw.alpha *= 0.91;
      if (sw.alpha < 0.03 || sw.r > sw.maxR) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = this.colCss(this.palette.accent, sw.alpha);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sw.x * vw, (1 - sw.y) * vh, sw.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Orbital phosphor ring + live scope halo
    const baseR = 24 + kick * 18 + this.dragEnergy * 16;
    ctx.strokeStyle = this.dragging ? '#ff5436' : main;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.stroke();

    const scope = this.telemetry.scope;
    if (scope && scope.length > 8) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= scope.length; i++) {
        const s = scope[i % scope.length] || 0;
        const a = (i / scope.length) * Math.PI * 2 + t * 0.6;
        const r = baseR + 10 + s * 28;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // 5. Rotating corner brackets
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * (this.dragging ? 2.4 : 0.45));
    const br = baseR + 8 + idm * 10;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI * 0.5);
      ctx.beginPath();
      ctx.moveTo(br - 7, -br);
      ctx.lineTo(br, -br);
      ctx.lineTo(br, -br + 7);
      ctx.stroke();
    }
    ctx.restore();

    // 6. Center diamond + floating telemetry
    ctx.fillStyle = this.dragging ? '#ff5436' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx - 6, cy);
    ctx.closePath();
    ctx.fill();

    const tagX = cx + baseR + 18 > vw - 210 ? cx - baseR - 205 : cx + baseR + 18;
    const tagY = cy - 10 < 24 ? cy + 28 : cy - 10;
    ctx.fillStyle = 'rgba(5, 7, 8, 0.80)';
    ctx.fillRect(tagX - 4, tagY - 12, 198, 18);
    ctx.strokeStyle = this.dragging ? '#ff5436' : main;
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX - 4, tagY - 12, 198, 18);
    ctx.fillStyle = '#e8ede9';
    ctx.font = '11px "Departure Mono", monospace';
    ctx.fillText(
      `X:${this.x.toFixed(2)} Y:${this.y.toFixed(2)} ${this.telemetry.idmMode} ${this.bpm}`,
      tagX,
      tagY + 1
    );

    ctx.restore();
  }
}
