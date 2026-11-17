/**
 * Main-thread Web Audio bridge for Haecceity Processor AudioWorklet.
 */

export class HaecceityAudioBridge {
  constructor(onTelemetry) {
    this.ctx = null;
    this.node = null;
    this.ready = false;
    this.initializing = false;
    this.onTelemetry = onTelemetry;
    this.pendingMessages = [];
  }

  async init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    if (this.initializing) return;
    this.initializing = true;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    await this.ctx.audioWorklet.addModule('./src/audio/haecceity-worklet.js?v=4');

    this.node = new AudioWorkletNode(this.ctx, 'haecceity-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    this.node.port.onmessage = (e) => {
      if (e.data?.type === 'telemetry' && this.onTelemetry) {
        this.onTelemetry(e.data);
      }
    };

    this.node.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.ready = true;
    this.initializing = false;

    for (const msg of this.pendingMessages) {
      this.node.port.postMessage(msg);
    }
    this.pendingMessages.length = 0;
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
