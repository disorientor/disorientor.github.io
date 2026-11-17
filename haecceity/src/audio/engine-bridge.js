/**
 * Main-thread Web Audio bridge for Haecceity Processor AudioWorklet.
 */

export class HaecceityAudioBridge {
  constructor(onTelemetry) {
    this.ctx = null;
    this.node = null;
    this.ready = false;
    this.initPromise = null;
    this.silentBuffer = null;
    this.onTelemetry = onTelemetry;
    this.pendingMessages = [];
  }

  ensureAudioSession() {
    try {
      if ('audioSession' in navigator && navigator.audioSession && navigator.audioSession.type !== 'playback') {
        navigator.audioSession.type = 'playback';
      }
    } catch (_) {}
  }

  ensureContext() {
    this.ensureAudioSession();
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    } catch (_) {
      this.ctx = new AudioCtx();
    }
    this.silentBuffer = null;
    return this.ctx;
  }

  /**
   * Synchronously unlocks/resumes Web Audio inside a user gesture call stack
   * (required by iOS Safari/WebKit, where activation expires across await).
   */
  unlock() {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
      try {
        if (!this.silentBuffer) {
          this.silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
        }
        const src = ctx.createBufferSource();
        src.buffer = this.silentBuffer;
        src.connect(ctx.destination);
        src.start(0);
      } catch (_) {}
    }
  }

  async init() {
    this.unlock();
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const ctx = this.ensureContext();
        if (!ctx) throw new Error('Web Audio API unavailable');
        if (!ctx.audioWorklet || !window.AudioWorkletNode) {
          throw new Error('AudioWorklet unavailable');
        }

        const workletUrl = new URL('./haecceity-worklet.js?v=8', import.meta.url).href;
        await ctx.audioWorklet.addModule(workletUrl);

        this.node = new AudioWorkletNode(ctx, 'haecceity-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });

        this.node.onprocessorerror = (err) => {
          console.error('Haecceity worklet error:', err);
        };

        this.node.port.onmessage = (e) => {
          if (e.data?.type === 'telemetry' && this.onTelemetry) {
            this.onTelemetry(e.data);
          }
        };

        this.node.connect(ctx.destination);
        this.ready = true;

        for (const msg of this.pendingMessages) {
          this.node.port.postMessage(msg);
        }
        this.pendingMessages.length = 0;

        if (ctx.state !== 'running' && ctx.state !== 'closed') {
          ctx.resume().catch(() => {});
        }
      } catch (err) {
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  send(msg) {
    if (this.ready && this.node) {
      this.node.port.postMessage(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  getSampleRate() {
    return this.ctx ? this.ctx.sampleRate : 48000;
  }
}
