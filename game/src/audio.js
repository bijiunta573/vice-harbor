// WebAudio synth: every sound is synthesized, no audio files. Engine hum follows speed.
export class SoundBank {
  constructor() {
    this.ctx = null; this.muted = false; this.master = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.padTimer = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain); this.engineGain.connect(this.master); this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master); this.sirenOsc.start();
    } catch { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
  blip(freq, dur, type = 'square', vol = 0.2, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  shot() { this.noise(0.14, 0.4, 2600); this.blip(160, 0.09, 'square', 0.18, -110); }
  reload() { this.blip(320, 0.06, 'square', 0.15); setTimeout(() => this.blip(520, 0.06, 'square', 0.15), 120); }
  pickup() { this.blip(660, 0.09, 'sine', 0.22); setTimeout(() => this.blip(990, 0.14, 'sine', 0.22), 80); }
  cash() { this.blip(880, 0.07, 'triangle', 0.2); setTimeout(() => this.blip(1320, 0.12, 'triangle', 0.2), 60); }
  sting() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 110)); }
  fail() { this.blip(220, 0.3, 'sawtooth', 0.2, -120); }
  honk() { this.blip(370, 0.16, 'square', 0.1); }
  crash() { this.noise(0.25, 0.45, 700); }
  hurt() { this.blip(140, 0.15, 'sawtooth', 0.2, -60); }
  setEngine(speedRatio, driving) {
    if (!this.ctx) return;
    const target = driving && !this.muted ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speedRatio) * 130, this.ctx.currentTime, 0.08);
  }
  setSiren(active, t) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(active && !this.muted ? 0.035 : 0, this.ctx.currentTime, 0.15);
    if (active) this.sirenOsc.frequency.setValueAtTime(650 + Math.sin(t * 5.2) * 180, this.ctx.currentTime);
  }
  updateAmbience(dt) {
    if (!this.ctx || this.muted) return;
    this.padTimer -= dt;
    if (this.padTimer <= 0) { this.padTimer = 4.5; this.blip(196, 3.6, 'sine', 0.045); this.blip(294, 3.6, 'sine', 0.03); }
  }
}
