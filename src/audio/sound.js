// Sound effects, synthesized with the Web Audio API. No sound files are needed.
// musicOn: whether the background music starts switched on.
export function createSound({ musicOn = true } = {}) {
  let ctx = null;
  let master = null;
  let enabled = true;        // sound effects
  let musicEnabled = musicOn;
  let ambience = null;
  const last = {};

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function throttle(key, ms) {
    const now = performance.now();
    if (last[key] && now - last[key] < ms) return true;
    last[key] = now;
    return false;
  }

  function tone({ freq, type = 'sine', dur = 0.15, vol = 0.3, slide = 0, delay = 0 }) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.08, vol = 0.2, filter = 2000, delay = 0 }) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  // Background music: media/sounds/game.mp3, streamed and looped.
  // Browsers only allow audio after the player clicks or presses a key, so it starts on the first one.
  function startAmbience() {
    if (!musicEnabled) return;
    if (!ambience) {
      ambience = new Audio('media/sounds/game.mp3');
      ambience.loop = true;
      ambience.preload = 'none';
      ambience.volume = 0.35;
    }
    if (ambience.paused) ambience.play().catch(() => { /* blocked until a user gesture */ });
  }

  function stopAmbience() {
    if (ambience && !ambience.paused) ambience.pause();
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      startAmbience();
    },
    // Sound effects on or off.
    setEnabled(on) {
      enabled = on;
      if (master) master.gain.value = on ? 0.55 : 0;
    },
    isEnabled: () => enabled,
    // Background music on or off.
    setMusic(on) {
      musicEnabled = on;
      if (on) startAmbience(); else stopAmbience();
    },
    isMusic: () => musicEnabled,

    strike(power) { noise({ dur: 0.05, vol: 0.25 + power * 0.4, filter: 1800 }); tone({ freq: 180, dur: 0.06, vol: 0.12 }); },
    ballClick(speed) {
      if (throttle('ball', 35)) return;
      tone({ freq: 1800 + Math.random() * 400, type: 'triangle', dur: 0.05, vol: Math.min(0.35, 0.05 + speed / 300) });
    },
    rail(speed) {
      if (throttle('rail', 50)) return;
      noise({ dur: 0.07, vol: Math.min(0.3, 0.04 + speed / 400), filter: 500 });
    },
    bumper(changed, owner) {
      if (throttle('bumper', 30)) return;
      if (changed) {
        const base = owner === 'human' ? 660 : 520;
        tone({ freq: base, dur: 0.18, vol: 0.25, type: 'square' });
        tone({ freq: base * 1.5, dur: 0.22, vol: 0.18, delay: 0.06 });
      } else {
        tone({ freq: 340, dur: 0.08, vol: 0.18, type: 'triangle' });
      }
    },
    drop() { tone({ freq: 500, dur: 0.45, vol: 0.3, slide: -380 }); noise({ dur: 0.25, vol: 0.12, filter: 300, delay: 0.1 }); },
    scratch() { tone({ freq: 140, type: 'sawtooth', dur: 0.6, vol: 0.25, slide: -60 }); },
    coin() {
      for (let i = 0; i < 4; i++) tone({ freq: 2400 + i * 120, dur: 0.25, vol: 0.12, delay: i * 0.07, type: 'triangle' });
    },
    coinLand() { tone({ freq: 3100, dur: 0.4, vol: 0.12, type: 'triangle' }); },
    raise() { tone({ freq: 880, dur: 0.1, vol: 0.18 }); tone({ freq: 1320, dur: 0.12, vol: 0.15, delay: 0.08 }); },
    holeOpen() { [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.3, vol: 0.18, delay: i * 0.09 })); },
    win() {
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.28, vol: 0.22, delay: i * 0.12, type: 'square' }));
    },
    lose() { [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.35, vol: 0.2, delay: i * 0.18, type: 'triangle' })); },
  };
}
