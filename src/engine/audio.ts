// الصوت: مؤثرات مولّدة بالكود كبديل افتراضي + أصوات مرفوعة من لوحة الإدارة. لا يعمل أي صوت قبل تفاعل المستخدم.
export interface Vol { master: number; sfx: number; ambient: number; music: number }

class AudioSys {
  ctx: AudioContext | null = null;
  vol: Vol = { master: 0.8, sfx: 0.9, ambient: 0.5, music: 0.4 };
  sounds: Record<string, { file: string; volume: number }> = {};
  private buf = new Map<string, AudioBuffer | null>();
  private amb: { key: string; stop: () => void } | null = null; private wx: { key: string; stop: () => void } | null = null; private mus: { key: string; stop: () => void } | null = null;
  private master!: GainNode; private noise!: AudioBuffer;

  setCatalog(list: any[]) { this.sounds = {}; for (const s of list || []) this.sounds[s.key] = { file: '/uploads/' + s.file, volume: s.volume ?? 1 }; }
  // يُستدعى فقط من داخل حدث تفاعل (نقر/لمس/مفتاح)
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); const c = this.ctx!;
    this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(c.destination);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  setVol(v: Partial<Vol>) { Object.assign(this.vol, v); if (this.ctx) this.master.gain.value = this.vol.master; }
  private async load(key: string): Promise<AudioBuffer | null> {
    const s = this.sounds[key]; if (!s || !this.ctx) return null;
    if (this.buf.has(s.file)) return this.buf.get(s.file)!;
    this.buf.set(s.file, null);
    try { const r = await fetch(s.file); const b = await this.ctx.decodeAudioData(await r.arrayBuffer()); this.buf.set(s.file, b); return b; } catch { return null; }
  }
  private out(g: number) { const n = this.ctx!.createGain(); n.gain.value = g; n.connect(this.master); return n; }
  private tone(f: number, t0: number, dur: number, type: OscillatorType, g: number, dest: AudioNode, f2?: number) {
    const c = this.ctx!, o = c.createOscillator(), e = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(e); e.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  private burst(t0: number, dur: number, freq: number, g: number, dest: AudioNode, type: BiquadFilterType = 'lowpass') {
    const c = this.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), e = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = type; f.frequency.value = freq;
    e.gain.setValueAtTime(g, t0); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(e); e.connect(dest); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  play(key: string, gain = 1) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const up = this.sounds[key];
    if (up) { this.load(key).then((b) => { if (!b || !this.ctx) return; const s = c.createBufferSource(); s.buffer = b; s.connect(this.out(this.vol.sfx * up.volume * gain)); s.start(); }); return; }
    const d = this.out(this.vol.sfx * gain), t = c.currentTime;
    const seq = (notes: number[], step: number, type: OscillatorType, g = 0.22, len = 0.28) => notes.forEach((n, i) => this.tone(n, t + i * step, len, type, g, d));
    switch (key) {
      case 'achievement': seq([523, 659, 784, 1047, 1319], 0.1, 'triangle', 0.25, 0.4); this.tone(1568, t + 0.5, 0.6, 'sine', 0.12, d); break;
      case 'win': seq([392, 523, 659, 784, 1047, 784, 1047], 0.13, 'triangle', 0.25, 0.45); break;
      case 'lose': seq([440, 392, 330, 262], 0.2, 'sawtooth', 0.12, 0.4); break;
      case 'mission_done': seq([587, 740, 880], 0.11, 'triangle', 0.22, 0.35); break;
      case 'world_enter': seq([294, 370, 440, 587], 0.12, 'sine', 0.2, 0.6); break;
      case 'world_exit': seq([587, 440, 294], 0.12, 'sine', 0.18, 0.5); break;
      case 'block_break': this.burst(t, 0.16, 900, 0.5, d); this.tone(160, t, 0.1, 'square', 0.08, d, 70); break;
      case 'block_place': this.tone(220, t, 0.09, 'sine', 0.3, d, 110); this.burst(t, 0.05, 1800, 0.15, d); break;
      case 'dig': this.burst(t, 0.07, 700, 0.22, d); break;
      case 'step': this.burst(t, 0.06, 500, 0.12, d); break;
      case 'hurt': this.tone(300, t, 0.2, 'sawtooth', 0.2, d, 120); break;
      case 'eat': [0, 0.12, 0.24].forEach((o) => this.burst(t + o, 0.07, 1200, 0.25, d, 'bandpass')); break;
      case 'ui_click': this.tone(660, t, 0.06, 'triangle', 0.15, d); break;
      case 'chat': this.tone(880, t, 0.08, 'sine', 0.12, d); this.tone(1175, t + 0.07, 0.1, 'sine', 0.1, d); break;
      case 'pickup': this.tone(700, t, 0.08, 'sine', 0.14, d, 1100); break;
      case 'thunder': this.burst(t, 2.2, 140, 0.9, d); this.burst(t + 0.1, 0.5, 2500, 0.2, d); break;
      case 'fuse': this.burst(t, 1.2, 4000, 0.18, d, 'highpass'); break;
      case 'explode': this.burst(t, 1.6, 220, 1.0, d); this.burst(t, 0.4, 1200, 0.5, d); this.tone(70, t, 0.8, 'sine', 0.5, d, 30); break;
      case 'splash': this.burst(t, 0.3, 1400, 0.3, d, 'bandpass'); break;
    }
  }
  private loop(key: string, kind: 'ambient' | 'music', synth?: (dest: GainNode) => () => void): { key: string; stop: () => void } | null {
    const c = this.ctx; if (!c) return null;
    const g = this.out(0); const vol = kind === 'music' ? this.vol.music : this.vol.ambient;
    let stopFn: () => void = () => {}; let dead = false;
    const up = this.sounds[key];
    if (up) this.load(key).then((b) => { if (!b || dead) return; const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(g); s.start(); stopFn = () => s.stop(); g.gain.linearRampToValueAtTime(vol * up.volume, c.currentTime + 1.5); });
    else if (synth) { stopFn = synth(g); g.gain.linearRampToValueAtTime(vol, c.currentTime + 1.5); }
    else return null;
    return { key, stop: () => { dead = true; g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0, c.currentTime + 1); setTimeout(() => { try { stopFn(); } catch { /* */ } g.disconnect(); }, 1200); } };
  }
  private noiseLoop(dest: GainNode, type: BiquadFilterType, freq: number, q: number, level: number, lfo: number, depth: number) {
    const c = this.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), e = c.createGain(), o = c.createOscillator(), og = c.createGain();
    s.buffer = this.noise; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; e.gain.value = level; o.frequency.value = lfo; og.gain.value = depth;
    o.connect(og); og.connect(e.gain); s.connect(f); f.connect(e); e.connect(dest); s.start(); o.start();
    return () => { s.stop(); o.stop(); };
  }
  // صوت المحيط حسب البيئة + الطقس
  setAmbient(kind: string, weather: string) {
    if (!this.ctx) return;
    const ak = 'ambient_' + kind;
    if (this.amb?.key !== ak) {
      this.amb?.stop();
      this.amb = this.loop(ak, 'ambient', (d) => kind === 'sea' ? this.noiseLoop(d, 'lowpass', 600, 0.5, 0.35, 0.12, 0.3) : kind === 'city' ? this.noiseLoop(d, 'lowpass', 180, 0.5, 0.3, 0.05, 0.08) : kind === 'mountain' ? this.noiseLoop(d, 'bandpass', 520, 1.2, 0.3, 0.09, 0.22) : this.noiseLoop(d, 'bandpass', 380, 0.9, 0.25, 0.07, 0.2));
    }
    const wk = weather === 'rain' || weather === 'storm' ? 'rain' : weather === 'sandstorm' ? 'wind' : '';
    if ((this.wx?.key || '') !== wk) {
      this.wx?.stop(); this.wx = null;
      if (wk) this.wx = this.loop(wk, 'ambient', (d) => wk === 'rain' ? this.noiseLoop(d, 'highpass', 2200, 0.3, 0.5, 0.3, 0.06) : this.noiseLoop(d, 'bandpass', 700, 2, 0.8, 0.15, 0.5));
    }
  }
  setMusic(key: string | null) {
    if (!this.ctx) return;
    if ((this.mus?.key || null) === key) return;
    this.mus?.stop(); this.mus = key ? this.loop(key, 'music') : null;
  }
  stopAll() { this.amb?.stop(); this.wx?.stop(); this.mus?.stop(); this.amb = this.wx = this.mus = null; }
  // معاينة ملف في لوحة الإدارة
  async preview(url: string, volume: number) { this.unlock(); const c = this.ctx!; const r = await fetch(url); const b = await c.decodeAudioData(await r.arrayBuffer()); const s = c.createBufferSource(); s.buffer = b; s.connect(this.out(volume)); s.start(); return () => s.stop(); }
}
export const audio = new AudioSys();
