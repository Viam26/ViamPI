const Music = {
  ctx: null,
  master: null,
  on: false,
  timer: 0,

  unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  tone(type, freq, start, dur, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.02);
  },

  loop() {
    if (!this.on || !this.ctx) return;
    const t0 = this.ctx.currentTime + 0.04;
    const b = 0.22;
    const lead = [523, 659, 784, 659, 698, 880, 784, 659, 587, 698, 659, 523, 392, 523, 587, 784];
    const bass = [131, 131, 196, 175, 147, 147, 196, 131];
    lead.forEach((f, i) => this.tone("square", f, t0 + i * b, 0.18, 0.045));
    bass.forEach((f, i) => this.tone("triangle", f, t0 + i * b * 2, 0.4, 0.055));
    this.tone("square", 784, t0 + b * 15, 0.2, 0.03);
    this.timer = setTimeout(() => this.loop(), b * 16 * 1000);
  },

  play() {
    this.unlock();
    if (this.on) return;
    this.on = true;
    this.loop();
  },

  stop() {
    this.on = false;
    clearTimeout(this.timer);
  },

  toggle() {
    if (this.on) this.stop();
    else this.play();
    return this.on;
  },

  win() {
    this.unlock();
    const t0 = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone("square", f, t0 + i * 0.12, 0.2, 0.08));
  },

  lose() {
    this.unlock();
    const t0 = this.ctx.currentTime;
    [392, 349, 294, 220].forEach((f, i) => this.tone("square", f, t0 + i * 0.16, 0.22, 0.08));
  },
};
