const COLORS = ["#ff7a1a", "#ffd60a", "#34c759", "#0a84ff", "#ff375f", "#bf5af2", "#f5ebdc"];
const RIBBON_COLORS = ["#FFD700", "#FF69B4", "#00CED1", "#FF4500"];
const SPECIAL_EMOJIS = ["🌈", "⭐", "🦄"];
const MAX_SPECIAL_EMOJIS = ["🌈", "⭐", "🦄", "🏅", "❤️", "🎵", "🎶", "🦝"];

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// iOS mutes Web Audio when the hardware silent switch is on, so the app cannot control its own
// sound. Marking the audio session as "playback" (Safari 16.4+) makes it ignore the switch; older
// iOS needs a real <audio> element playing (silently) alongside the Web Audio output. That element
// makes iOS show the app in the Dynamic Island / lock screen as "now playing", so it is only used
// where audioSession is missing, and the session goes back to "auto" once the sound ends.
let silentEl = null;
function makeSilentAudio() {
  const rate = 8000;
  const n = rate; // 1s of silence
  const b = new Uint8Array(44 + n).fill(128);
  const dv = new DataView(b.buffer);
  const str = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  str(0, "RIFF"); dv.setUint32(4, 36 + n, true); str(8, "WAVEfmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true); str(36, "data"); dv.setUint32(40, n, true);
  const el = new Audio(URL.createObjectURL(new Blob([b], { type: "audio/wav" })));
  el.loop = true;
  return el;
}

function setPlaybackSession(type = "playback") {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch (e) {
    // unsupported, ignore
  }
}

// Called on the first user gesture so a later (non-gesture) play() is allowed.
function primeAudio() {
  if (navigator.audioSession) return;
  try {
    if (!silentEl) silentEl = makeSilentAudio();
    const p = silentEl.play();
    if (p && p.then) p.then(() => silentEl.pause()).catch(() => {});
  } catch (e) {
    // ignore
  }
}

["touchend", "pointerdown", "click"].forEach((evt) => {
  document.addEventListener(evt, primeAudio, { once: true, capture: true });
});

// --- Celebration sound: synthesized with Web Audio, one distinct score per tier ---
const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };

function makeReverb(ctx, seconds = 1.8) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

function makeNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function createSynth(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const dry = ctx.createGain();
  dry.connect(master);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  const reverb = makeReverb(ctx);
  reverb.connect(wet).connect(master);
  const out = ctx.createGain();
  out.connect(dry);
  out.connect(reverb);

  // A bright, slightly detuned note (two oscillators + a soft octave) with a bell-like decay.
  function tone(freq, at, dur = 0.5, { type = "triangle", vol = 0.16, attack = 0.012, detune = 6, octave = 0.35 } = {}) {
    const t = ctx.currentTime + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    [[type, freq, -detune, 1], [type, freq, detune, 1], ["sine", freq * 2, 0, octave]].forEach(([wave, f, det, amp]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = wave;
      o.frequency.value = f;
      o.detune.value = det;
      og.gain.value = amp * 0.5;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  // Sustained brassy chord (sawtooth through a lowpass) for fanfare hits.
  function brass(freqs, at, dur = 0.6, vol = 0.07) {
    const t = ctx.currentTime + at;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.linearRampToValueAtTime(3200, t + 0.08);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(out);
    freqs.forEach((f) => {
      [-7, 7].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      });
    });
  }

  // Short filtered-noise burst: a confetti "pop".
  function pop(at, vol = 0.35) {
    const t = ctx.currentTime + at;
    const n = makeNoise(ctx, 0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1800, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.12);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    n.connect(bp).connect(g).connect(out);
    n.start(t);
    n.stop(t + 0.2);
    thump(at, 0.5 * vol);
  }

  // Low sine drop: the body of a pop, a firework boom, or a drum hit.
  function thump(at, vol = 0.3, f0 = 150, f1 = 45, dur = 0.25) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Rising filtered-noise whoosh (firework launch / build-up).
  function sweep(at, dur = 0.8, f0 = 300, f1 = 5000, vol = 0.18) {
    const t = ctx.currentTime + at;
    const n = makeNoise(ctx, dur + 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp).connect(g).connect(out);
    n.start(t);
    n.stop(t + dur + 0.1);
  }

  // Cluster of tiny high pings, like glitter.
  function sparkle(at, count = 8, span = 0.6, vol = 0.07) {
    const pool = [N.C6, N.E6, N.G6, N.C7, N.B5, N.G5];
    for (let i = 0; i < count; i++) {
      tone(pool[Math.floor(Math.random() * pool.length)], at + Math.random() * span, 0.25, { type: "sine", vol, octave: 0, detune: 0 });
    }
  }

  // Fast rising arpeggio run.
  function run(notes, at, step = 0.07, dur = 0.4, vol = 0.14) {
    notes.forEach((f, i) => tone(f, at + i * step, dur, { vol }));
  }

  // Firework crackle: rapid random tiny ticks.
  function crackle(at, span = 1, count = 22) {
    for (let i = 0; i < count; i++) {
      const t = ctx.currentTime + at + Math.random() * span;
      const n = makeNoise(ctx, 0.05);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 3000 + Math.random() * 3000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08 + Math.random() * 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.connect(hp).connect(g).connect(out);
      n.start(t);
      n.stop(t + 0.05);
    }
  }

  return { tone, brass, pop, thump, sweep, sparkle, run, crackle };
}

// Each score gets the tier's confetti burst/shell times (seconds) so booms line up with the visuals.
const SCORES = {
  small(s) {
    s.pop(0, 0.3);
    s.sparkle(0.05, 4, 0.3);
    s.tone(N.G5, 0.05, 0.35);
    s.tone(N.C6, 0.14, 0.5);
  },
  medium(s, { bursts }) {
    s.tone(N.E5, 0, 0.5);
    s.tone(N.B5, 0.09, 0.7);
    s.tone(N.E6, 0.18, 0.9, { vol: 0.13 });
    s.sparkle(0.2, 8, 0.9);
    bursts.forEach((t) => s.pop(t));
  },
  large(s, { bursts, shells }) {
    s.sweep(0, 0.5, 400, 4000, 0.15);
    s.run([N.C5, N.E5, N.G5, N.C6, N.E6], 0.45, 0.07, 0.6);
    s.brass([N.C5, N.E5, N.G5], 0.85, 0.9, 0.06);
    s.sparkle(0.9, 12, 1.5);
    bursts.forEach((t) => s.pop(t));
    shells.forEach((t) => {
      s.sweep(t, 0.35, 500, 3500, 0.1);
      s.thump(t + 0.35, 0.35, 120, 40, 0.4);
      s.crackle(t + 0.35, 0.5, 10);
    });
  },
  xlarge(s, { bursts, shells, duration }) {
    // Fanfare: G-G-G-C (dotted) then a big major chord.
    s.thump(0, 0.4);
    s.brass([N.G4, N.C5, N.E5], 0.1, 0.16);
    s.brass([N.G4, N.C5, N.E5], 0.3, 0.16);
    s.brass([N.G4, N.C5, N.E5], 0.5, 0.16);
    s.brass([N.C5, N.E5, N.G5], 0.7, 1.2, 0.08);
    s.run([N.C5, N.E5, N.G5, N.C6, N.E6, N.G6], 0.75, 0.06, 0.7);
    s.sparkle(0.9, 16, 2.5);
    s.sweep(2.4, 1, 300, 6000, 0.15);
    s.run([N.G5, N.B5, N.D5 * 2, N.G6], 3.2, 0.08, 0.8, 0.13);
    bursts.forEach((t) => s.pop(t));
    shells.forEach((t) => {
      s.sweep(t, 0.4, 500, 4000, 0.1);
      s.thump(t + 0.4, 0.4, 120, 40, 0.45);
      s.crackle(t + 0.4, 0.7, 14);
    });
    s.crackle(duration / 1000 - 1, 1.2, 16);
  },
  max(s, { bursts, shells, duration }) {
    const total = duration / 1000;
    // Drum-roll build into the big hit.
    for (let i = 0; i < 14; i++) s.thump(i * 0.08 + i * i * 0.004, 0.12 + i * 0.015, 220, 90, 0.12);
    s.sweep(0, 1.4, 200, 7000, 0.2);
    // Grand fanfare (C major -> F -> G -> C)
    s.thump(1.4, 0.6, 130, 35, 0.6);
    s.brass([N.C4, N.E4, N.G4, N.C5], 1.4, 1.0, 0.09);
    s.run([N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, N.C7], 1.4, 0.055, 0.9);
    s.sparkle(1.5, 24, 3);
    s.brass([N.F5 / 2, N.A4, N.C5, N.F5], 2.6, 0.7, 0.08);
    s.brass([N.G4, N.B4, N.D5, N.G5], 3.3, 0.7, 0.08);
    s.brass([N.C5, N.E5, N.G5, N.C6], 4.0, 2.2, 0.09);
    s.run([N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, N.C7], 4.0, 0.05, 1.2, 0.12);
    s.thump(4.0, 0.6, 130, 35, 0.7);
    // Celebratory melody bouncing over the middle section (C-D-E-G-E-G-C).
    [N.E5, N.G5, N.C6, N.G5, N.C6, N.E6, N.C6, N.E6, N.G6].forEach((f, i) => s.tone(f, 6.4 + i * 0.16, 0.5, { vol: 0.13 }));
    s.sweep(8.4, 1.2, 300, 7000, 0.18);
    // Final ascending run and closing chord.
    s.run([N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.E6, N.G6, N.C7], 9.6, 0.07, 1.0);
    s.brass([N.C5, N.E5, N.G5, N.C6], 10.3, 1.6, 0.09);
    s.thump(10.3, 0.6, 130, 35, 0.8);
    s.sparkle(10.3, 24, 1.6);
    bursts.forEach((t) => s.pop(t, 0.4));
    shells.forEach((t) => {
      s.sweep(t, 0.4, 500, 4000, 0.1);
      s.thump(t + 0.4, 0.45, 120, 40, 0.5);
      s.crackle(t + 0.4, 0.8, 16);
    });
    s.crackle(0, total, 60);
  },
};

function playCelebrationSound(tier, config) {
  try {
    const score = SCORES[tier];
    if (!score) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    setPlaybackSession();
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    if (silentEl) silentEl.play().catch(() => {});
    const at = (i, n) => (n === 1 ? 0 : i * (config.duration / (n + 1))) / 1000;
    const bursts = Array.from({ length: config.burstCount }, (_, i) => at(i, config.burstCount));
    const shells = Array.from({ length: config.shells }, (_, i) => at(i, config.shells));
    score(createSynth(ctx), { bursts, shells, duration: config.duration });
    setTimeout(() => {
      ctx.close();
      if (silentEl) silentEl.pause();
      setPlaybackSession("auto");
    }, config.duration + 4000);
  } catch (e) {
    // audio not available, ignore
  }
}

class ParticleEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.running = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  resize() {
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  addConfettiBurst(count, originX, originY) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        size: 5 + Math.random() * 5,
        gravity: 0.12,
        drag: 0.99,
        life: 1,
        decay: 0.006 + Math.random() * 0.006,
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }
  }

  // Ribbons rain down from the top edge across [minX, maxX] like falling
  // streamers, rather than bursting outward from a point like confetti —
  // slower, longer, and with a side-to-side flutter as they fall.
  addRibbonBurst(count, minX, maxX) {
    for (let i = 0; i < count; i++) {
      const x = minX + Math.random() * (maxX - minX);
      this.particles.push({
        x,
        y: -20 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 1.2 + Math.random() * 1.3,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        color: RIBBON_COLORS[(Math.random() * RIBBON_COLORS.length) | 0],
        size: 34 + Math.random() * 22,
        gravity: 0.025,
        drag: 0.997,
        life: 1,
        decay: 0.0022 + Math.random() * 0.0015,
        shape: "ribbon",
        wavePhase: Math.random() * Math.PI * 2,
        waveSpeed: 0.06 + Math.random() * 0.05,
        waveAmplitude: 0.8 + Math.random() * 1,
      });
    }
  }

  addEmojiBurst(count, originX, originY, pool = SPECIAL_EMOJIS) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.12,
        emoji: pool[(Math.random() * pool.length) | 0],
        size: 22 + Math.random() * 10,
        gravity: 0.08,
        drag: 0.985,
        life: 1,
        decay: 0.005 + Math.random() * 0.004,
        shape: "emoji",
      });
    }
  }

  addFireworkShell(delay, originX, targetY) {
    setTimeout(() => {
      if (!this.running) return;
      const color = COLORS[(Math.random() * COLORS.length) | 0];
      const rocket = {
        x: originX,
        y: window.innerHeight,
        vx: (Math.random() - 0.5) * 1,
        // Launch fast enough to always reach targetY before gravity kills its
        // climb — otherwise it explodes at its natural (much lower) apex,
        // which is what made shells look low regardless of targetY.
        vy: -(16 + Math.random() * 3),
        targetY,
        isRocket: true,
        color,
        life: 1,
        decay: 0,
        size: 3,
      };
      this.particles.push(rocket);
    }, delay);
  }

  explode(x, y, color) {
    const count = 60;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: 0,
        rotationSpeed: 0,
        color,
        size: 3 + Math.random() * 2,
        gravity: 0.05,
        drag: 0.97,
        life: 1,
        decay: 0.012 + Math.random() * 0.01,
        shape: "circle",
        glow: true,
      });
    }
  }

  start() {
    this.running = true;
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    const step = () => {
      if (!this.running) return;
      this.tick();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = [];
  }

  tick() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.isRocket) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.vy >= 0 || p.y <= p.targetY) {
          this.explode(p.x, p.y, p.color);
          this.particles.splice(i, 1);
        }
        continue;
      }

      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life -= p.decay;

      if (p.shape === "ribbon") {
        p.wavePhase += p.waveSpeed;
        p.x += Math.sin(p.wavePhase) * p.waveAmplitude;
      }

      if (p.life <= 0 || p.y > window.innerHeight + 40) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.shape === "emoji") {
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.emoji, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        if (p.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
        }
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "ribbon") {
          ctx.fillRect(-p.size / 2, -p.size / 14, p.size, p.size / 7);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    if (this.particles.length === 0 && this._finishedTimer === undefined) {
      this._finishedTimer = setTimeout(() => {
        if (this.particles.length === 0) this.stop();
      }, 400);
    } else if (this.particles.length > 0 && this._finishedTimer) {
      clearTimeout(this._finishedTimer);
      this._finishedTimer = undefined;
    }
  }
}

const TIER_CONFIG = {
  small: { burstCount: 1, particlesPerBurst: 40, duration: 1500, shells: 0, emojiRounds: 0, ribbonEveryMs: 0 },
  medium: { burstCount: 3, particlesPerBurst: 45, duration: 2500, shells: 0, emojiRounds: 0, ribbonEveryMs: 0 },
  large: { burstCount: 4, particlesPerBurst: 55, duration: 4000, shells: 3, emojiRounds: 0, ribbonEveryMs: 0 },
  xlarge: { burstCount: 6, particlesPerBurst: 60, duration: 5000, shells: 5, emojiRounds: 1, emojiPool: SPECIAL_EMOJIS, ribbonEveryMs: 1800 },
  max: { burstCount: 8, particlesPerBurst: 65, duration: 12000, shells: 8, emojiRounds: 4, emojiPool: MAX_SPECIAL_EMOJIS, ribbonEveryMs: 1500 },
};

export function celebrate(canvas, tier, soundEnabled) {
  const reduced = prefersReducedMotion();
  const config = TIER_CONFIG[tier] || TIER_CONFIG.small;
  const engine = new ParticleEngine(canvas);
  engine.start();

  const w = window.innerWidth;
  const h = window.innerHeight;

  if (reduced) {
    engine.addConfettiBurst(15, w / 2, h * 0.3);
  } else {
    if (config.burstCount > 0) {
      for (let i = 0; i < config.burstCount; i++) {
        const delay = config.burstCount === 1 ? 0 : i * (config.duration / (config.burstCount + 1));
        const x = w * (0.15 + Math.random() * 0.7);
        const y = h * (0.15 + Math.random() * 0.2);
        setTimeout(() => engine.addConfettiBurst(config.particlesPerBurst, x, y), delay);
      }
    }
    if (config.shells > 0) {
      for (let i = 0; i < config.shells; i++) {
        const x = w * (0.2 + Math.random() * 0.6);
        const targetY = h * (0.08 + Math.random() * 0.15);
        engine.addFireworkShell(i * (config.duration / (config.shells + 1)), x, targetY);
      }
    }
    if (config.emojiRounds > 0) {
      for (let i = 0; i < config.emojiRounds; i++) {
        const delay = ((i + 1) / (config.emojiRounds + 1)) * config.duration;
        const x = w * (0.2 + Math.random() * 0.6);
        const y = h * (0.15 + Math.random() * 0.2);
        setTimeout(() => engine.addEmojiBurst(8, x, y, config.emojiPool), delay);
      }
    }
    if (config.ribbonEveryMs > 0) {
      // Ribbons rain from the top on a steady cadence throughout the
      // celebration, rather than bursting once from a point like confetti.
      let delay = 600;
      while (delay < config.duration) {
        setTimeout(() => engine.addRibbonBurst(10, w * 0.05, w * 0.95), delay);
        delay += config.ribbonEveryMs;
      }
    }
  }

  if (soundEnabled && !reduced) {
    playCelebrationSound(tier in TIER_CONFIG ? tier : "small", config);
  }

  setTimeout(() => engine.stop(), config.duration + 500);
  return engine;
}
