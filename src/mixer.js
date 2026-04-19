import { ac, deckA, deckB, attachAudio, scheduleDeck, stopDeck, masterAnalyser } from './audio.js';
import { LIBRARY } from './library.js';
import { detectBpm, detectKey } from './lib.js';

export let xfaderVal = 0.5;

export function applyCrossfader() {
  const a = Math.cos(xfaderVal * Math.PI/2);
  const b = Math.sin(xfaderVal * Math.PI/2);
  deckA.xfaderGain.gain.setTargetAtTime(a, ac.currentTime, 0.01);
  deckB.xfaderGain.gain.setTargetAtTime(b, ac.currentTime, 0.01);
  const readout = document.getElementById('xfader-readout');
  if (xfaderVal < 0.05) readout.textContent = "à fond sur A";
  else if (xfaderVal > 0.95) readout.textContent = "à fond sur B";
  else if (xfaderVal < 0.4) readout.textContent = "vers A";
  else if (xfaderVal > 0.6) readout.textContent = "vers B";
  else readout.textContent = "centre";
  document.getElementById('xfader-thumb').style.left = (xfaderVal * 100) + "%";
}

export function adjustXfader(delta) {
  xfaderVal = Math.max(0, Math.min(1, xfaderVal + delta));
  applyCrossfader();
}

export function wireXfader() {
  const track = document.getElementById('xfader-track');
  let dragging = false;
  const setFromX = (clientX) => {
    const r = track.getBoundingClientRect();
    xfaderVal = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    applyCrossfader();
  };
  track.addEventListener('mousedown', e => { dragging = true; setFromX(e.clientX); });
  window.addEventListener('mousemove', e => { if (dragging) setFromX(e.clientX); });
  window.addEventListener('mouseup', () => dragging = false);
  track.addEventListener('touchstart', e => { dragging = true; setFromX(e.touches[0].clientX); e.preventDefault(); }, {passive:false});
  window.addEventListener('touchmove', e => { if (dragging) setFromX(e.touches[0].clientX); }, {passive:true});
  window.addEventListener('touchend', () => dragging = false);
}

export function wireChannelFader(id, deck) {
  const track = document.getElementById(id);
  const fill = track.querySelector('.c-fill');
  const thumb = track.querySelector('.c-thumb');
  let dragging = false;
  let v = 0.75;
  const apply = () => {
    fill.style.height = (v * 100) + "%";
    thumb.style.bottom = (v * 100) + "%";
    deck.gain.gain.setTargetAtTime(v, ac.currentTime, 0.01);
  };
  const setFromY = (clientY) => {
    const r = track.getBoundingClientRect();
    v = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
    apply();
  };
  track.addEventListener('mousedown', e => { dragging = true; setFromY(e.clientY); });
  window.addEventListener('mousemove', e => { if (dragging) setFromY(e.clientY); });
  window.addEventListener('mouseup', () => dragging = false);
  track.addEventListener('touchstart', e => { dragging = true; setFromY(e.touches[0].clientY); e.preventDefault(); }, {passive:false});
  window.addEventListener('touchmove', e => { if (dragging) setFromY(e.touches[0].clientY); }, {passive:true});
  window.addEventListener('touchend', () => dragging = false);
  apply();
}

export function wireEq(prefix, deck) {
  const ids = ['hi','mid','lo'];
  ids.forEach(band => {
    const input = document.getElementById(`${band}-${prefix}`);
    const val = document.getElementById(`${band}-${prefix}-val`);
    const apply = () => {
      const v = parseFloat(input.value);
      val.textContent = (v>0?'+':'') + v.toFixed(0);
      deck[band].gain.setTargetAtTime(v, ac.currentTime, 0.01);
    };
    input.addEventListener('input', apply);
    apply();
  });
}

export function wirePitch(prefix, deck) {
  const pitchIn = document.getElementById(`pitch-${prefix}-input`);
  const pitchLbl = document.getElementById(`pitch-${prefix}`);
  const gainIn = document.getElementById(`gain-${prefix}-input`);
  const gainLbl = document.getElementById(`gain-${prefix}`);
  const gainHdr = document.getElementById(`gain-${prefix}-disp`);
  pitchIn.addEventListener('input', () => {
    const v = parseFloat(pitchIn.value);
    deck.pitch = v;
    pitchLbl.textContent = (v>=0?'+':'') + v.toFixed(1).replace('.',',') + " %";
    if (deck.playing) {
      if (deck.audio) deck.audio.playbackRate = 1 + v / 100;
      else scheduleDeck(deck);
    }
  });
  gainIn.addEventListener('input', () => {
    const v = parseFloat(gainIn.value);
    const linear = Math.pow(10, v/20);
    deck.input.gain.setTargetAtTime(linear, ac.currentTime, 0.02);
    const t = (v>0?'+':'') + v.toFixed(1) + " dB";
    gainLbl.textContent = t; gainHdr.textContent = t;
  });
}

export function loadTrack(deckId, trackIdx) {
  const deck = deckId === 'a' ? deckA : deckB;
  const track = LIBRARY[trackIdx];
  deck.track = track;
  document.getElementById(`artist-${deckId}`).textContent = track.artist;
  document.getElementById(`title-${deckId}`).textContent = track.title;
  document.getElementById(`contrib-${deckId}`).textContent = track.contrib;
  document.getElementById(`bpm-${deckId}`).textContent = track.bpm ?? '—';
  document.getElementById(`key-${deckId}`).textContent = track.key || '—';
  deck.url = track.url;
  if (deck.playing) stopDeck(deck);
  attachAudio(deck, track.url || null);
  analyzeTrack(deckId, trackIdx, track.url || null);
  renderWave(deckId, track);
  renderGlitch(deckId, track);
  document.querySelectorAll('#library-body tr').forEach(r => r.classList.remove(`loaded-${deckId}`));
  const row = document.querySelector(`#library-body tr[data-idx="${trackIdx}"]`);
  if (row) row.classList.add(`loaded-${deckId}`);
  if (deck.playing) { scheduleDeck(deck); }
}

export async function togglePlay(deckId) {
  if (ac.state === "suspended") await ac.resume();
  const deck = deckId === 'a' ? deckA : deckB;
  if (!deck.track) return;
  const btn = document.getElementById(`play-${deckId}`);
  if (deck.playing) {
    stopDeck(deck);
    btn.classList.remove('active');
    btn.querySelector('.tri').style.borderLeft = '7px solid currentColor';
    btn.querySelector('.tri').style.borderTop = '5px solid transparent';
    btn.querySelector('.tri').style.borderBottom = '5px solid transparent';
    btn.querySelector('span:last-child').textContent = 'Play';
    document.getElementById(`art-${deckId}`).classList.add('idle');
  } else {
    deck.playing = true;
    scheduleDeck(deck);
    btn.classList.add('active');
    const t = btn.querySelector('.tri');
    t.style.border = '0'; t.style.width = '8px'; t.style.height = '8px'; t.style.background = 'currentColor';
    btn.querySelector('span:last-child').textContent = 'Pause';
    document.getElementById(`art-${deckId}`).classList.remove('idle');
  }
}

export function sync(deckId) {
  const a = deckA, b = deckB;
  const me = deckId==='a'?a:b, other = deckId==='a'?b:a;
  if (!me.track || !other.track) return;
  const targetBpm = other.track.bpm * (1 + other.pitch/100);
  const p = ((targetBpm / me.track.bpm) - 1) * 100;
  const clamped = Math.max(-8, Math.min(8, p));
  document.getElementById(`pitch-${deckId}-input`).value = clamped;
  document.getElementById(`pitch-${deckId}-input`).dispatchEvent(new Event('input'));
}

export function renderWave(deckId, track) {
  const el = document.getElementById(`wave-bars-${deckId}`);
  el.innerHTML = "";
  const n = 180;
  const seed = track.artist.length + track.title.length + track.bpm;
  for (let i = 0; i < n; i++) {
    const s = Math.sin(i*0.19 + seed) * 0.5 + Math.sin(i*0.07 + seed*0.3) * 0.3 + Math.random()*0.2;
    const h = Math.max(8, Math.min(100, 40 + s*55));
    const bar = document.createElement('i');
    bar.style.height = h + "%";
    el.appendChild(bar);
  }
  const wave = document.getElementById(`wave-${deckId}`);
  wave.querySelectorAll('.wave-beat').forEach(b=>b.remove());
  for (let k = 1; k < 8; k++) {
    const bm = document.createElement('div');
    bm.className = 'wave-beat' + (k%4===0?' strong':'');
    bm.style.left = (k * 12.5) + "%";
    wave.appendChild(bm);
  }
}

export function renderGlitch(deckId, track) {
  const art = document.getElementById(`art-${deckId}`);
  art.querySelectorAll('.glitch-strip, .glitch-hue').forEach(e=>e.remove());
  const seed = (track.artist + track.title).split('').reduce((a,c)=>a+c.charCodeAt(0), 0);
  const strips = 5 + (seed % 6);
  for (let i = 0; i < strips; i++) {
    const s = document.createElement('div');
    s.className = 'glitch-strip';
    const top = ((seed * (i+1) * 17) % 100);
    const h = 2 + ((seed * (i+2)) % 14);
    const off = ((seed * (i+3) * 13) % 20) - 10;
    s.style.top = top + "%";
    s.style.height = h + "%";
    s.style.background = i % 2 ? "#000" : "#fff";
    s.style.transform = `translateX(${off}px)`;
    art.appendChild(s);
  }
}

export async function analyzeTrack(deckId, trackIdx, url) {
  if (!url) return;
  let decoded;
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    decoded = await ac.decodeAudioData(buf);
  } catch(e) { console.warn('analyzeTrack decode failed:', e); return; }

  const bpm = detectBpm(decoded);
  const key = detectKey(decoded);

  const track = LIBRARY[trackIdx];
  if (!track) return;
  track.bpm = bpm;
  track.key = key;

  const deck = deckId === 'a' ? deckA : deckB;
  if (deck.track === track) {
    document.getElementById(`bpm-${deckId}`).textContent = bpm ?? '—';
    document.getElementById(`key-${deckId}`).textContent = key || '—';
    renderWave(deckId, track);
  }

  const row = document.querySelector(`#library-body tr[data-idx="${trackIdx}"]`);
  if (row) {
    const cells = row.querySelectorAll('td');
    cells[2].textContent = bpm ?? '—';
    cells[3].textContent = key || '—';
  }
}

export function buildMeter(el, n) {
  el.innerHTML = "";
  for (let i = 0; i < n; i++) { const c = document.createElement('i'); c.className='off'; el.appendChild(c); }
}

export function rms(analyser, buf) {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i]-128)/128; sum += v*v;
  }
  return Math.sqrt(sum / buf.length);
}

const bufA = new Uint8Array(deckA.analyser.fftSize);
const bufB = new Uint8Array(deckB.analyser.fftSize);
const bufM = new Uint8Array(masterAnalyser.fftSize);

export function animate() {
  const ra = rms(deckA.analyser, bufA);
  const rb = rms(deckB.analyser, bufB);
  const rm = rms(masterAnalyser, bufM);
  const mA = document.getElementById('meter-a').children;
  const mB = document.getElementById('meter-b').children;
  const mM = document.getElementById('vu-master').children;
  const lit = (cells, level) => {
    const n = Math.round(Math.min(1, level*4) * cells.length);
    for (let i=0;i<cells.length;i++) cells[i].classList.toggle('off', i >= n);
  };
  lit(mA, ra); lit(mB, rb); lit(mM, rm);
  updatePlayhead('a', deckA);
  updatePlayhead('b', deckB);
  requestAnimationFrame(animate);
}

export function updatePlayhead(id, deck) {
  const ph = document.querySelector(`#wave-${id} .wave-playhead`);
  if (!deck.track) { ph.style.left = "0%"; return; }

  let pos = 0, total = 0;
  if (deck.audio && deck.audio.duration > 0) {
    pos = deck.audio.currentTime;
    total = deck.audio.duration;
  } else {
    const secPerBeat = 60 / ((deck.track.bpm || 120) * (1 + deck.pitch/100));
    pos = deck.playing ? (deck.beatIndex * secPerBeat) : 0;
    const dur = deck.track.dur ?? "0:0";
    const [m,s] = dur.split(':').map(Number);
    total = m*60 + s;
  }

  const frac = total > 0 ? Math.min(1, pos / total) : 0;
  ph.style.left = (frac * 100) + "%";
  const rem = Math.max(0, total - pos);
  const fmt = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  document.getElementById(`time-${id}`).textContent = fmt(pos);
  document.getElementById(`remain-${id}`).textContent = "-" + fmt(rem);
  const bars = document.getElementById(`wave-bars-${id}`).children;
  const cutoff = Math.floor(frac * bars.length);
  for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('past', i < cutoff);
}

buildMeter(document.getElementById('meter-a'), 16);
buildMeter(document.getElementById('meter-b'), 16);
buildMeter(document.getElementById('vu-master'), 40);
