/**
 * ConectaFone - 60 FPS Canvas Audio Visualizer
 */

export class AudioVisualizer {
  constructor(canvasElement, analyserNode) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.analyser = analyserNode;
    this.isRunning = false;
    this.animationFrameId = null;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  start() {
    this.isRunning = true;
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  render() {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(() => this.render());

    const dpr = window.devicePixelRatio || 1;
    const parentWidth = this.canvas.parentElement.clientWidth || 360;
    this.canvas.width = parentWidth * dpr;
    this.canvas.height = 90 * dpr;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.analyser.getByteFrequencyData(this.dataArray);

    const barCount = 32;
    const barWidth = (this.canvas.width / barCount) * 0.7;
    const gap = (this.canvas.width / barCount) * 0.3;

    for (let i = 0; i < barCount; i++) {
      const val = (this.dataArray[i] || 4) / 255.0;
      const barHeight = Math.max(4 * dpr, val * this.canvas.height * 0.9);
      const x = i * (barWidth + gap) + gap / 2;
      const y = this.canvas.height - barHeight;

      const grad = this.ctx.createLinearGradient(0, y, 0, this.canvas.height);
      grad.addColorStop(0, '#00f2fe');
      grad.addColorStop(1, '#00f5a0');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [3 * dpr, 3 * dpr, 0, 0]);
      this.ctx.fill();
    }
  }
}
