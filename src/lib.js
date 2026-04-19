export function fixBadEscapes(str) {
  const valid = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
  const out = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const nxt = str[i + 1];
      if (valid.has(nxt)) {
        if (nxt === 'u' && /^[0-9a-fA-F]{4}/.test(str.slice(i + 2, i + 6))) {
          out.push(str.slice(i, i + 6)); i += 6;
        } else {
          out.push(str[i], str[i + 1]); i += 2;
        }
      } else {
        out.push('\\\\'); i += 1;
      }
    } else {
      out.push(str[i]); i += 1;
    }
  }
  return out.join('');
}

export function mapPost(p) {
  return {
    artist:          (p.track && p.track.author)          || '—',
    title:           (p.track && p.track.title)           || '—',
    bpm:             null,
    key:             '',
    dur:             null,
    contrib:         (p.contributor && p.contributor.name) || '',
    contributorSlug: (p.contributor && p.contributor.slug) || '',
    mood:            '',
    url:             (p.track && p.track.href) ? p.track.href.replace(/\+/g, '%20') : null,
    slug:            p.id || null,
    buyUrl:          p.buy_url || '',
  };
}

export function detectBpm(audioBuffer) {
  try { return Math.round(new globalThis.MusicTempo(audioBuffer).tempo); }
  catch(e) { return null; }
}

export function detectKey(audioBuffer) {
  const ch = audioBuffer.getChannelData(0);
  const bufSize = 4096;
  const chroma = new Float32Array(12);
  let count = 0;
  const maxSamples = Math.min(ch.length, audioBuffer.sampleRate * 15);
  for (let i = 0; i + bufSize <= maxSamples; i += bufSize) {
    const frame = ch.slice(i, i + bufSize);
    const c = globalThis.Meyda.extract('chroma', frame);
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
