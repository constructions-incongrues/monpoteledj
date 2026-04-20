try {
  importScripts(
    'https://cdn.jsdelivr.net/npm/music-tempo@1.0.3/dist/browser/music-tempo.min.js',
    'https://cdn.jsdelivr.net/npm/meyda@5.6.3/dist/web/meyda.min.js'
  );
} catch(e) { /* CDN load failure — detections will return null */ }

function detectBpm(ch) {
  try { return Math.round(new MusicTempo(ch).tempo); }
  catch(e) { return null; }
}

function detectKey(ch, sampleRate) {
  const bufSize = 4096;
  const chroma = new Float32Array(12);
  let count = 0;
  const maxSamples = Math.min(ch.length, sampleRate * 15);
  for (let i = 0; i + bufSize <= maxSamples; i += bufSize) {
    const c = Meyda.extract('chroma', ch.slice(i, i + bufSize));
    if (!c) continue;
    for (let j = 0; j < 12; j++) chroma[j] += c[j];
    count++;
  }
  if (!count) return null;
  for (let j = 0; j < 12; j++) chroma[j] /= count;

  const majorP = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minorP = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
  const majorC = ['8B','3B','10B','5B','12B','7B','2B','9B','4B','11B','6B','1B'];
  const minorC = ['10A','5A','12A','7A','2A','9A','4A','11A','6A','1A','8A','3A'];
  const pearson = (a, p) => {
    let sx=0,sy=0,sxy=0,sx2=0,sy2=0;
    for(let i=0;i<12;i++){sx+=a[i];sy+=p[i];sxy+=a[i]*p[i];sx2+=a[i]*a[i];sy2+=p[i]*p[i];}
    return (12*sxy-sx*sy)/(Math.sqrt((12*sx2-sx*sx)*(12*sy2-sy*sy))||1);
  };
  let best = null, bestScore = -Infinity;
  for (let r = 0; r < 12; r++) {
    const rot = Array.from({length:12}, (_,i) => chroma[(i+r)%12]);
    const ms = pearson(rot, majorP), ns = pearson(rot, minorP);
    if (ms > bestScore) { bestScore = ms; best = majorC[r]; }
    if (ns > bestScore) { bestScore = ns; best = minorC[r]; }
  }
  return best;
}

function fmtDur(secs) {
  const m = Math.floor(secs / 60);
  return m + ':' + String(secs % 60).padStart(2, '0');
}

// Receives already-decoded channel data from the main thread (no OfflineAudioContext needed)
self.onmessage = ({ data: { trackIdx, channelData, sampleRate, duration } }) => {
  try {
    const ch = channelData;
    const dur = fmtDur(Math.round(duration));
    const bpm = detectBpm(ch);
    const key = detectKey(ch, sampleRate);

    // RMS waveform amplitudes (180 blocks)
    const n = 180;
    const blockSize = Math.floor(ch.length / n);
    const amplitudes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(ch[i * blockSize + j]);
      amplitudes[i] = sum / blockSize;
    }
    const max = Math.max(...amplitudes);
    if (max > 0) for (let i = 0; i < n; i++) amplitudes[i] /= max;

    self.postMessage({ trackIdx, bpm, key, dur, amplitudes }, [amplitudes.buffer]);
  } catch(err) {
    self.postMessage({ trackIdx, bpm: null, key: null, dur: null, amplitudes: null, error: err.message });
  }
};
