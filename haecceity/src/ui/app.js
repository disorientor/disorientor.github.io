/**
 * Haecceity Web — Full-Screen X/Y Audiovisual Instrument
 * - Drag anywhere across the screen to sweep a single X/Y coordinate that mutates everything
 * - Click "haecceity" (top-right) to reroll a radical new scene across all 51 backgrounds,
 *   13 GPU foreground fields, and 40 glitch shaders
 * - Double-click anywhere for MumbleSpeak Departure Mono word box (auto-activates Textmode/Terrain)
 * - Drag [|||....] channel volume bars left/right on a single bottom row
 */

import { createScene, allocateFromXY } from '../xy-allocator.js';
import { HaecceityAudioBridge } from '../audio/engine-bridge.js';
import { textToPhonemes } from '../audio/mumble.js';
import { HaecceityGPUEngine } from '../visual/haecceity-gpu.js';
import { CoordinateOverlay } from '../visual/foregrounds.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function renderBarString(norm, slots = 10) {
  const filled = Math.round(clamp(norm, 0, 1) * slots);
  let out = '[';
  for (let i = 0; i < slots; i++) out += i < filled ? '|' : '.';
  return out + ']';
}

const VOLUME_CHANNELS = [
  { key: 'kickGain',     label: 'KICK',  value: 0.56, max: 1.2 },
  { key: 'drumGain',     label: 'DRUM',  value: 0.58, max: 1.2 },
  { key: 'idmGain',      label: 'TRACK', value: 0.72, max: 1.3 },
  { key: 'unstableGain', label: 'PATH',  value: 0.56, max: 1.2 },
  { key: 'mumbleGain',   label: 'MUMB',  value: 0.82, max: 1.2 },
  { key: 'masterGain',   label: 'MSTR',  value: 0.88, max: 1.2 },
];

class HaecceityStageApp {
  constructor() {
    this.x = 0.48;
    this.y = 0.52;
    this.draggingXY = false;
    this.playing = false;
    this.audioConfigured = false;
    this.lastAudioSyncMs = 0;
    this.lastMumbleText = '';

    this.scene = createScene(0xdead);
    this.currentFrame = allocateFromXY(this.scene, this.x, this.y);

    this.gpu = new HaecceityGPUEngine(document.getElementById('bg-shader'));
    this.reticle = new CoordinateOverlay(document.getElementById('fg-canvas'));
    this.audio = new HaecceityAudioBridge((t) => this.onTelemetry(t));

    this.setupAudioUnlock();
    this.setupStageInteraction();
    this.setupHaecceityButton();
    this.setupMumbleModal();
    this.setupVolumeDock();
    this.setupKeyboard();

    this.applyFrame(true);
    this.startLoop();
  }

  setupAudioUnlock() {
    const unlock = () => this.audio.unlock();
    for (const ev of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'click', 'keydown']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.audio.ctx) unlock();
    });
    window.addEventListener('pageshow', () => {
      if (this.audio.ctx) unlock();
    });
  }

  async bootAudioAndPlay() {
    this.audio.unlock();
    const hint = document.getElementById('boot-hint');
    if (hint) hint.classList.add('is-hidden');

    if (!this.audio.ready) {
      await this.audio.init();
    }
    if (!this.audioConfigured) {
      this.audioConfigured = true;
      this.audio.send({ type: 'scene', seed16: this.scene.seed16 });
      for (const ch of VOLUME_CHANNELS) {
        this.audio.send({ type: 'mixParam', key: ch.key, value: ch.value });
      }
      this.audio.send({ type: 'xyFrame', frame: this.currentFrame });
    }
    if (!this.playing) {
      this.playing = true;
      this.audio.send({ type: 'transport', playing: true, bpm: this.currentFrame.bpm });
    }
  }

  applyFrame(forceAudio = false) {
    this.currentFrame = allocateFromXY(this.scene, this.x, this.y);
    const f = this.currentFrame;

    this.gpu.setVisual(f.visual);
    this.gpu.setXY(this.x, this.y, this.draggingXY);

    this.reticle.setState({
      x: this.x,
      y: this.y,
      dragging: this.draggingXY,
      bpm: f.bpm,
      palette: this.scene.palette,
    });

    const now = performance.now();
    if (forceAudio || now - this.lastAudioSyncMs >= 32) {
      this.lastAudioSyncMs = now;
      this.audio.send({ type: 'xyFrame', frame: f });
    }
  }

  changeScene() {
    const nextSeed = Math.floor(Math.random() * 0x10000);
    const bgCount = this.gpu.manifest?.backgrounds?.length || 51;
    const glCount = this.gpu.manifest?.glitches?.length || 40;
    this.scene = createScene(nextSeed, { backgroundCount: bgCount, glitchCount: glCount });

    this.gpu.resetSimulations();
    this.gpu.setMumbleAutoMode(nextSeed % 3);
    this.audio.send({ type: 'scene', seed16: this.scene.seed16 });
    this.applyFrame(true);
  }

  setupStageInteraction() {
    const fgCanvas = document.getElementById('fg-canvas');

    const updateXYFromEvent = (e, isDrag) => {
      const rect = fgCanvas.getBoundingClientRect();
      this.x = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      this.y = clamp(1 - (e.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      this.draggingXY = isDrag;
      this.applyFrame(false);
    };

    fgCanvas.addEventListener('pointerdown', (e) => {
      const modal = document.getElementById('mumble-modal');
      if (!modal.hidden) {
        modal.hidden = true;
        return;
      }
      e.preventDefault();
      this.audio.unlock();
      void this.bootAudioAndPlay().catch((err) => console.error(err));
      this.draggingXY = true;
      try {
        fgCanvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      updateXYFromEvent(e, true);
    });

    fgCanvas.addEventListener('pointermove', (e) => {
      if (!this.draggingXY) return;
      updateXYFromEvent(e, true);
    });

    const endDrag = (e) => {
      if (!this.draggingXY) return;
      this.draggingXY = false;
      try {
        if (fgCanvas.hasPointerCapture(e.pointerId)) fgCanvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
      this.applyFrame(true);
    };
    fgCanvas.addEventListener('pointerup', endDrag);
    fgCanvas.addEventListener('pointercancel', endDrag);
  }

  setupHaecceityButton() {
    const btn = document.getElementById('haecceity-btn');
    btn.addEventListener('click', () => {
      this.audio.unlock();
      void this.bootAudioAndPlay().catch((err) => console.error(err));
      this.changeScene();
    });
  }

  setupMumbleModal() {
    const fgCanvas = document.getElementById('fg-canvas');
    const modal = document.getElementById('mumble-modal');
    const input = document.getElementById('mumble-input');

    fgCanvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const boxW = Math.min(420, vw - 24);
      const left = clamp(e.clientX - 24, 12, Math.max(12, vw - boxW - 12));
      const top = clamp(e.clientY - 22, 16, Math.max(16, vh - 96));

      modal.style.left = `${left}px`;
      modal.style.top = `${top}px`;
      modal.hidden = false;
      input.value = this.lastMumbleText;
      input.focus();
      input.select();
    });

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = input.value.trim();
        this.lastMumbleText = text;
        modal.hidden = true;
        await this.bootAudioAndPlay();

        if (!text) {
          this.audio.send({ type: 'mumblePhrase', phonemes: [] });
          return;
        }

        // Automatically select textmode (0), terrain (1), or both (2)
        const fgs = this.currentFrame.visual.foregroundFields;
        const autoChoice = fgs.includes('textmode') && fgs.includes('terrain') ? 2
          : fgs.includes('terrain') ? 1
          : fgs.includes('textmode') ? 0
          : (this.scene.seed16 % 3);
        this.gpu.setMumbleAutoMode(autoChoice);

        const phonemes = textToPhonemes(text, {
          speed: 125,
          pitchRange: 7,
          seed: this.scene.seed16,
        });
        this.audio.send({ type: 'mumblePhrase', phonemes });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        modal.hidden = true;
      }
    });
  }

  setupVolumeDock() {
    const dock = document.getElementById('volume-dock');

    for (const ch of VOLUME_CHANNELS) {
      const item = document.createElement('div');
      item.className = 'vol-chan';
      item.title = `${ch.label}: drag left/right to adjust volume`;

      const lbl = document.createElement('span');
      lbl.className = 'vol-lbl';
      lbl.textContent = ch.label;

      const bar = document.createElement('span');
      bar.className = 'vol-bar';
      bar.textContent = renderBarString(ch.value / ch.max, 10);

      item.append(lbl, bar);
      dock.appendChild(item);

      let dragging = false;
      let startX = 0;
      let startVal = ch.value;

      const setVol = (v) => {
        ch.value = clamp(v, 0, ch.max);
        bar.textContent = renderBarString(ch.value / ch.max, 10);
        this.audio.send({ type: 'mixParam', key: ch.key, value: ch.value });
      };

      item.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.unlock();
        void this.bootAudioAndPlay().catch((err) => console.error(err));
        dragging = true;
        startX = e.clientX;
        startVal = ch.value;
        item.classList.add('is-dragging');
        try {
          item.setPointerCapture(e.pointerId);
        } catch (_) {}
      });

      item.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const sens = e.shiftKey ? 0.0025 : 0.0075;
        setVol(startVal + dx * sens);
      });

      const stopVolDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        item.classList.remove('is-dragging');
        if (item.hasPointerCapture(e.pointerId)) item.releasePointerCapture(e.pointerId);
      };
      item.addEventListener('pointerup', stopVolDrag);
      item.addEventListener('pointercancel', stopVolDrag);

      item.addEventListener('wheel', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.bootAudioAndPlay();
        setVol(ch.value + (e.deltaY < 0 || e.deltaX > 0 ? 0.06 : -0.06));
      }, { passive: false });
    }
  }

  setupKeyboard() {
    window.addEventListener('keydown', async (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        await this.bootAudioAndPlay().catch(() => {});
        if (this.audio.ready) {
          this.playing = !this.playing;
          this.audio.send({ type: 'transport', playing: this.playing, bpm: this.currentFrame.bpm });
        }
      }
    });
  }

  onTelemetry(t) {
    this.gpu.updateTelemetry(t);
    this.reticle.updateTelemetry(t);
  }

  startLoop() {
    const tick = () => {
      this.gpu.render();
      this.reticle.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new HaecceityStageApp();
});
