// Web Audio synthesis: no bundled audio files. Must be unlocked by a real
// user gesture (a tap) before iOS Safari will allow sound.
//
// House rule: NOTHING sounds during a round. The only in-play sound is the
// buzzer when the 40 seconds run out. "They got it!" plays a short win
// flourish because it ends the game, not a round mid-play.
const GameAudio = (() => {
  let ctx = null;

  function unlock() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
    return ctx;
  }

  // Rising three-note flourish for "They got it!".
  function win() {
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + (i === 2 ? 0.32 : 0.16));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    });
  }

  // End-of-round buzzer: a chopped, dissonant dual-tone — a stovetop-timer
  // "BZZT-BZZT-BZZT", deliberately unlike a smooth descending siren.
  function buzzer() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const dur = 1.05;

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = "square";
    oscB.type = "square";
    oscA.frequency.setValueAtTime(196, t0);
    oscB.frequency.setValueAtTime(233, t0);
    // A short sag at the very end for finality.
    oscA.frequency.setValueAtTime(196, t0 + dur - 0.16);
    oscA.frequency.linearRampToValueAtTime(150, t0 + dur);
    oscB.frequency.setValueAtTime(233, t0 + dur - 0.16);
    oscB.frequency.linearRampToValueAtTime(178, t0 + dur);

    const body = ctx.createGain();
    body.gain.setValueAtTime(0, t0);
    body.gain.linearRampToValueAtTime(0.3, t0 + 0.02);
    body.gain.setValueAtTime(0.3, t0 + dur - 0.1);
    body.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    // A fast square LFO gates the amplitude to make the "brrrt" chop.
    const chop = ctx.createOscillator();
    chop.type = "square";
    chop.frequency.setValueAtTime(15, t0);
    const chopDepth = ctx.createGain();
    chopDepth.gain.value = 0.5;
    const chopBias = ctx.createConstantSource();
    chopBias.offset.value = 0.5;
    const gate = ctx.createGain();
    gate.gain.value = 0;
    chop.connect(chopDepth).connect(gate.gain);
    chopBias.connect(gate.gain);

    oscA.connect(body);
    oscB.connect(body);
    body.connect(gate).connect(ctx.destination);

    const stop = t0 + dur + 0.05;
    oscA.start(t0); oscB.start(t0); chop.start(t0); chopBias.start(t0);
    oscA.stop(stop); oscB.stop(stop); chop.stop(stop); chopBias.stop(stop);
  }

  return { unlock, win, buzzer };
})();
