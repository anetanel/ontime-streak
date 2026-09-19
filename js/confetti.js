const COLORS = ["#ff7a1a", "#ffd60a", "#34c759", "#0a84ff", "#ff375f", "#bf5af2", "#f5ebdc"];
const RIBBON_COLORS = ["#FFD700", "#FF69B4", "#00CED1", "#FF4500"];
const SPECIAL_EMOJIS = ["🌈", "⭐", "🦄"];
const MAX_SPECIAL_EMOJIS = ["🌈", "⭐", "🦄", "🏅"];

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playChime(kind) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = kind === "cheer" ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
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
  small: { burstCount: 1, particlesPerBurst: 40, duration: 1500, shells: 0, sound: null, emojiRounds: 0, ribbonEveryMs: 0 },
  medium: { burstCount: 3, particlesPerBurst: 45, duration: 2500, shells: 0, sound: "chime", emojiRounds: 0, ribbonEveryMs: 0 },
  large: { burstCount: 4, particlesPerBurst: 55, duration: 4000, shells: 3, sound: "chime", emojiRounds: 0, ribbonEveryMs: 0 },
  xlarge: { burstCount: 6, particlesPerBurst: 60, duration: 5000, shells: 5, sound: "cheer", emojiRounds: 1, emojiPool: SPECIAL_EMOJIS, ribbonEveryMs: 1800 },
  max: { burstCount: 8, particlesPerBurst: 65, duration: 6000, shells: 8, sound: "cheer", emojiRounds: 2, emojiPool: MAX_SPECIAL_EMOJIS, ribbonEveryMs: 1500 },
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

  if (soundEnabled && config.sound && !reduced) {
    playChime(config.sound);
  }

  setTimeout(() => engine.stop(), config.duration + 500);
  return engine;
}
