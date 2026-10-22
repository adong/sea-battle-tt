/* TT Sea Battle: the game's own sounds, built on Kit.sound.tone / hiss (all synthesised, no files).
   SEA.sfx.kit(name, ...args) plays a kit effect; the rest are ours. Every call is a silent no-op until
   Kit.sound.init() has run from the first tap. */
(function () {
  'use strict';
  const SEA = (window.SEA = window.SEA || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o);
  const hiss = (o) => S.hiss(o);

  const sfx = {
    kit(name, ...args) {
      if (S[name]) S[name](...args);
    },
    // the cannon: a soft toy boom and a whistle as the ball flies
    boom() {
      tone({ f: 120, to: 45, dur: 0.28, vol: 0.28 });
      hiss({ filter: 'lowpass', f: 900, to: 200, dur: 0.3, vol: 0.22 });
      tone({ type: 'sine', f: 1400, to: 700, dur: 0.6, vol: 0.035, at: 0.1 });
    },
    // the ball lands in the water
    splash() {
      hiss({ filter: 'bandpass', f: 1800, to: 500, q: 0.7, dur: 0.45, vol: 0.22 });
      tone({ type: 'sine', f: 420, to: 900, dur: 0.12, vol: 0.08, at: 0.02 });
      [0.12, 0.22, 0.3].forEach((at, i) => tone({ type: 'sine', f: 900 + i * 260, to: 1300 + i * 300, dur: 0.06, vol: 0.05, at }));
    },
    // the ball bonks a ship: a cartoon clang
    bonk() {
      S.punch();
      tone({ type: 'square', f: 523, to: 392, dur: 0.18, vol: 0.06, lp: 2400, at: 0.03 });
      tone({ type: 'triangle', f: 1046, to: 784, dur: 0.25, vol: 0.08, at: 0.03 });
    },
    // a ship sinks: glug glug glug, then a little fanfare for whoever sank it
    sink(good) {
      [0, 0.18, 0.36].forEach((at, i) => tone({ type: 'sine', f: 300 - i * 50, to: 140 - i * 20, dur: 0.16, vol: 0.12, at }));
      if (good) [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, at: 0.55 + i * 0.09, dur: 0.2, vol: 0.09 }));
      else [392, 330].forEach((f, i) => tone({ type: 'triangle', f, at: 0.55 + i * 0.16, dur: 0.22, vol: 0.07 }));
    },
    // the aim square moves
    tick() { tone({ type: 'square', f: 1200, dur: 0.025, vol: 0.02, lp: 3000 }); },
    // can't shoot there / a ship can't go there
    nope() {
      tone({ f: 220, dur: 0.08, vol: 0.08 });
      tone({ f: 180, dur: 0.1, vol: 0.08, at: 0.09 });
    },
    // a ship picked up, put down, turned
    lift() { tone({ type: 'triangle', f: 500, to: 800, dur: 0.1, vol: 0.07 }); },
    drop() {
      tone({ type: 'triangle', f: 700, to: 420, dur: 0.1, vol: 0.08 });
      hiss({ filter: 'bandpass', f: 1400, q: 1, dur: 0.12, vol: 0.06 });
    },
    turn() { [660, 880].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.08, vol: 0.07 })); },
    shuffle() { [0, 0.07, 0.14, 0.21].forEach((at, i) => tone({ type: 'triangle', f: 500 + i * 120, dur: 0.06, vol: 0.06, at })); },
    // Foxy is aiming: a little "hmm" (and Froggy's ribbit)
    think() { tone({ type: 'triangle', f: 330, to: 392, dur: 0.3, vol: 0.05 }); },
    ribbit() {
      tone({ type: 'square', f: 180, to: 140, dur: 0.07, vol: 0.05, lp: 900 });
      tone({ type: 'square', f: 200, to: 150, dur: 0.09, vol: 0.05, lp: 900, at: 0.1 });
    },
    // a good shot / a tip
    nice() { [784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.18, vol: 0.1 })); },
    // the whole fleet sunk: you won
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f, at: i * 0.11, dur: 0.16, vol: 0.05, lp: 3000 }));
      [523, 659, 784].forEach((f) => tone({ type: 'triangle', f: f * 2, at: 0.46, dur: 0.6, vol: 0.08 }));
      hiss({ filter: 'highpass', f: 6000, at: 0.46, dur: 0.5, vol: 0.06 });
      [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.9 + i * 0.09, dur: 0.3, vol: 0.08 }));
    },
    // the CPU won: a soft wah-wah, never harsh
    lose() {
      [392, 370, 349, 311].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.22, dur: i === 3 ? 0.5 : 0.22, vol: 0.09 }));
    },
    // your brother pops in (and out)
    pop() {
      tone({ f: 300, to: 900, dur: 0.12, vol: 0.1 });
      hiss({ f: 2000, to: 6000, dur: 0.15, vol: 0.05 });
    },
    // the high five: a clap
    clap() {
      hiss({ filter: 'bandpass', f: 1500, q: 0.8, dur: 0.09, vol: 0.22 });
      hiss({ filter: 'highpass', f: 3000, dur: 0.05, vol: 0.1, at: 0.01 });
    },
    // the pass-the-device screen: a ship's bell
    bell() { [0, 0.35].forEach((at) => tone({ type: 'sine', f: 1318, to: 1310, dur: 0.6, vol: 0.07, at })); },
  };

  SEA.sfx = sfx;
})();
