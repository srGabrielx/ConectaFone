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
    this.synthOscillators = [];
  }

  async ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass({
        latencyHint: 'interactive',
        sampleRate: 44100
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
      this.ctx = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 44100 });
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

  /**
   * Cria uma faixa de áudio ativa para inicializar o canal WebRTC
   */
  createSilentStream() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.00001, this.ctx.currentTime); // quase inaudível mas com frames PCM ativos
    const dest = this.ctx.createMediaStreamDestination();

    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    return dest.stream;
  }

  /**
   * Toca um bip de teste no celular para confirmar funcionamento do alto-falante
   */
  playTestBeep() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.2); // A5

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  /**
   * Stream sintético para teste no Host
   */
  createSynthStream() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    this.stopSynth();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const dest = this.ctx.createMediaStreamDestination();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, this.ctx.currentTime); // A4
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(554.37, this.ctx.currentTime); // C#5

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);

    osc1.start();
    osc2.start();

    this.synthOscillators = [osc1, osc2];
    return dest.stream;
  }

  stopSynth() {
    this.synthOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.synthOscillators = [];
  }
}
