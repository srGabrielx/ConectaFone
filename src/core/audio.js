/**
 * ConectaFone - Audio Core Engine
 * Web Audio API Manager: Master Gain, Delay Node (Lip-Sync), Analyser, Test Synth and Silent Tracks
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.delayNode = null;
    this.analyser = null;
  }

  async ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass({
        latencyHint: 'interactive',
        sampleRate: 48000
      });
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  setupReceiverPipeline(volume = 1.0, delayMs = 0) {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);

    this.delayNode = this.ctx.createDelay(2.0); // até 2000ms
    this.delayNode.delayTime.setValueAtTime(Math.max(0, delayMs / 1000.0), this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.delayNode);
    this.delayNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    return {
      inputNode: this.masterGain,
      analyser: this.analyser
    };
  }

  setVolume(val) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setDelay(ms) {
    if (this.delayNode && this.ctx) {
      this.delayNode.delayTime.setValueAtTime(Math.max(0, ms / 1000.0), this.ctx.currentTime);
    }
  }


}

