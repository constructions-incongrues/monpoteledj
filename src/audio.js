export const ac = new (window.AudioContext || window.webkitAudioContext)();

export function keyToHz(keyStr) {
  const n = parseInt(keyStr) || 1;
  const base = 55;
  return base * Math.pow(2, ((n * 7) % 12) / 12);
}

const masterGain = ac.createGain(); masterGain.gain.value = 0.9;
export const masterAnalyser = ac.createAnalyser(); masterAnalyser.fftSize = 512;
masterGain.connect(masterAnalyser); masterAnalyser.connect(ac.destination);

const fxInput = ac.createGain(); fxInput.gain.value = 0;
const fxDry = ac.createGain(); fxDry.gain.value = 1;
const fxWet = ac.createGain(); fxWet.gain.value = 0;
const fxDelay = ac.createDelay(2.0); fxDelay.delayTime.value = 0.25;
const fxFeedback = ac.createGain(); fxFeedback.gain.value = 0.4;
const fxLowpass = ac.createBiquadFilter(); fxLowpass.type = "lowpass"; fxLowpass.frequency.value = 12000;
fxInput.connect(fxDry).connect(masterGain);
fxInput.connect(fxLowpass).connect(fxDelay).connect(fxWet).connect(masterGain);
fxDelay.connect(fxFeedback).connect(fxDelay);

export function makeDeck(id) {
  const input = ac.createGain();       input.gain.value = 1;
  const lo = ac.createBiquadFilter();  lo.type = "lowshelf";  lo.frequency.value = 250;
  const mid = ac.createBiquadFilter(); mid.type = "peaking";  mid.frequency.value = 1000; mid.Q.value = 1;
  const hi = ac.createBiquadFilter();  hi.type = "highshelf"; hi.frequency.value = 4000;
  const gain = ac.createGain();        gain.gain.value = 1;
  const xfaderGain = ac.createGain();  xfaderGain.gain.value = 0.5;
  const analyser = ac.createAnalyser(); analyser.fftSize = 256;

  input.connect(lo).connect(mid).connect(hi).connect(gain).connect(analyser);
  analyser.connect(xfaderGain).connect(masterGain);
  const fxSend = ac.createGain(); fxSend.gain.value = 0;
  analyser.connect(fxSend).connect(fxInput);

  return { id, input, lo, mid, hi, gain, xfaderGain, fxSend, analyser,
           playing: false, sources: [], track: null, pitch: 0,
           startedAt: 0, pausedAt: 0, duration: 0,
           loopBars: 0, loopActive: false,
           schedInterval: null, beatIndex: 0,
           audio: null, audioSource: null };
}

export function attachAudio(deck, url) {
  if (deck.audioSource) { deck.audioSource.disconnect(); deck.audioSource = null; }
  if (deck.audio) { deck.audio.pause(); deck.audio.src = ''; }
  if (!url) { deck.audio = null; return; }
  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.src = url;
  audio.loop = false;
  const src = ac.createMediaElementSource(audio);
  src.connect(deck.input);
  deck.audio = audio;
  deck.audioSource = src;
}

export const deckA = makeDeck("a");
export const deckB = makeDeck("b");

export function setDeckEq(deck, lo, mid, hi) {
  deck.lo.gain.setTargetAtTime(lo, ac.currentTime, 0.02);
  deck.mid.gain.setTargetAtTime(mid, ac.currentTime, 0.02);
  deck.hi.gain.setTargetAtTime(hi, ac.currentTime, 0.02);
}

export function scheduleDeck(deck) {
  const track = deck.track; if (!track) return;

  if (deck.audio) {
    deck.audio.playbackRate = 1 + deck.pitch / 100;
    return deck.audio.play();
  }

  if (deck.schedInterval) clearInterval(deck.schedInterval);
  const bpm = (track.bpm || 120) * (1 + deck.pitch/100);
  const beatMs = 60000 / bpm;
  deck.startedAt = ac.currentTime;
  const rootHz = keyToHz(track.key);
  const moodSeed = track.mood.length;
  const schedulerTick = () => {
    if (!deck.playing) return;
    const now = ac.currentTime;
    const b = deck.beatIndex;
    const loopBeats = deck.loopActive ? deck.loopBars * 4 : 0;
    const effB = loopBeats ? (b % Math.max(1, Math.round(loopBeats))) : b;
    playBeat(deck, effB, rootHz, moodSeed, now + 0.05);
    deck.beatIndex++;
  };
  schedulerTick();
  deck.schedInterval = setInterval(schedulerTick, beatMs);
}

export function playBeat(deck, b, rootHz, moodSeed, when) {
  if (b % 4 === 0) {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(110, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.15);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.9, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    o.connect(g).connect(deck.input); o.start(when); o.stop(when + 0.25);
  }
  if (b % 2 === 1) {
    const buf = ac.createBuffer(1, 2000, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 600);
    const src = ac.createBufferSource(); src.buffer = buf;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
    const g = ac.createGain(); g.gain.value = 0.15;
    src.connect(hp).connect(g).connect(deck.input);
    src.start(when); src.stop(when + 0.08);
  }
  {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = moodSeed % 3 === 0 ? "sawtooth" : (moodSeed % 3 === 1 ? "square" : "triangle");
    const scale = [0, 3, 5, 7, 10];
    const n = scale[(b + moodSeed) % scale.length];
    o.frequency.setValueAtTime(rootHz * Math.pow(2, n/12), when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.25, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800;
    o.connect(lp).connect(g).connect(deck.input);
    o.start(when); o.stop(when + 0.35);
  }
  if (b % 8 === 0) {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(rootHz * 2, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.08, when + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, when + 2.2);
    const lp = ac.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value = 1200;
    o.connect(lp).connect(g).connect(deck.input);
    o.start(when); o.stop(when + 2.3);
  }
}

export function stopDeck(deck) {
  if (deck.audio) { deck.audio.pause(); }
  if (deck.schedInterval) { clearInterval(deck.schedInterval); deck.schedInterval = null; }
  deck.playing = false;
}
