import { describe, test, expect, vi, afterEach } from 'vitest';
import { fixBadEscapes, mapPost, detectBpm, detectKey } from './lib.js';

afterEach(() => { vi.unstubAllGlobals(); });

// ── fixBadEscapes ───────────────────────────────────────────────────────────

describe('fixBadEscapes', () => {
  const BS = String.fromCharCode(92); // one real backslash char

  test('passes through strings without backslashes', () => {
    expect(fixBadEscapes('')).toBe('');
    expect(fixBadEscapes('hello world')).toBe('hello world');
  });

  test('preserves valid escape sequences', () => {
    expect(fixBadEscapes(BS + 'n')).toBe(BS + 'n');   // \n
    expect(fixBadEscapes(BS + 't')).toBe(BS + 't');   // \t
    expect(fixBadEscapes(BS + '"')).toBe(BS + '"');   // \"
    expect(fixBadEscapes(BS + BS)).toBe(BS + BS);     // \\
  });

  test('preserves valid \\uXXXX unicode escapes', () => {
    expect(fixBadEscapes(BS + 'u0041')).toBe(BS + 'u0041'); // \u0041 = A
    expect(fixBadEscapes(BS + 'u00e9')).toBe(BS + 'u00e9'); // \u00e9 = é
  });

  test('doubles stray backslash before space', () => {
    expect(fixBadEscapes(BS + ' hello')).toBe(BS + BS + ' hello');
  });

  test('doubles stray backslash before <', () => {
    expect(fixBadEscapes('text' + BS + '<b>')).toBe('text' + BS + BS + '<b>');
  });

  test('makes a malformed JSON string parseable', () => {
    const bad = '{"body":"hello' + BS + ' world"}';
    const fixed = fixBadEscapes(bad);
    expect(() => JSON.parse(fixed)).not.toThrow();
    expect(JSON.parse(fixed).body).toBe('hello' + BS + ' world');
  });
});

// ── mapPost ─────────────────────────────────────────────────────────────────

describe('mapPost', () => {
  test('maps all fields from a complete post', () => {
    const p = {
      id: 'test-post',
      buy_url: 'https://bandcamp.com/buy',
      track: { author: 'Artist', title: 'Song', href: 'https://example.com/song.mp3' },
      contributor: { name: 'DJ Foo', slug: 'dj-foo' },
    };
    const t = mapPost(p);
    expect(t.artist).toBe('Artist');
    expect(t.title).toBe('Song');
    expect(t.url).toBe('https://example.com/song.mp3');
    expect(t.contrib).toBe('DJ Foo');
    expect(t.contributorSlug).toBe('dj-foo');
    expect(t.slug).toBe('test-post');
    expect(t.buyUrl).toBe('https://bandcamp.com/buy');
  });

  test('falls back to — when track is absent', () => {
    const p = { id: 'slug', contributor: { name: 'X', slug: 'x' } };
    const t = mapPost(p);
    expect(t.artist).toBe('—');
    expect(t.title).toBe('—');
    expect(t.url).toBeNull();
  });

  test('falls back to empty strings when contributor is absent', () => {
    const p = { id: 'slug', track: { author: 'A', title: 'T', href: 'http://x.mp3' } };
    const t = mapPost(p);
    expect(t.contrib).toBe('');
    expect(t.contributorSlug).toBe('');
  });

  test('replaces + with %20 in URL', () => {
    const p = { id: 'x', track: { author: 'A', title: 'T', href: 'http://x.com/My+Track.mp3' } };
    expect(mapPost(p).url).toBe('http://x.com/My%20Track.mp3');
  });

  test('bpm, key, dur are always null / empty string / null', () => {
    const p = { id: 'x', track: { author: 'A', title: 'T', href: 'http://x.mp3' } };
    const t = mapPost(p);
    expect(t.bpm).toBeNull();
    expect(t.key).toBe('');
    expect(t.dur).toBeNull();
  });
});

// ── detectBpm ───────────────────────────────────────────────────────────────

describe('detectBpm', () => {
  const fakeBuffer = { sampleRate: 44100, getChannelData: () => new Float32Array(44100) };

  test('returns BPM rounded from MusicTempo.tempo', () => {
    vi.stubGlobal('MusicTempo', function() { this.tempo = 128.4; });
    expect(detectBpm(fakeBuffer)).toBe(128);
  });

  test('rounds up correctly', () => {
    vi.stubGlobal('MusicTempo', function() { this.tempo = 119.6; });
    expect(detectBpm(fakeBuffer)).toBe(120);
  });

  test('returns null when MusicTempo throws', () => {
    vi.stubGlobal('MusicTempo', function() { throw new Error('no beats'); });
    expect(detectBpm(fakeBuffer)).toBeNull();
  });
});

// ── detectKey ───────────────────────────────────────────────────────────────

describe('detectKey', () => {
  // KS profiles (same as in lib.js)
  const majorP = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minorP = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

  // Chroma that perfectly matches C major (root = 0 → Camelot 8B)
  const cMajorChroma = majorP.slice();

  // Chroma that perfectly matches A minor (root = 9 → Camelot 1A)
  // rot at r=9: chroma[(i+9)%12] must equal minorP[i]
  // so chroma[j] = minorP[(j - 9 + 12) % 12]
  const aMinorChroma = Array.from({ length: 12 }, (_, j) => minorP[(j - 9 + 12) % 12]);

  const makeMeyda = (chroma) => ({ extract: () => chroma });

  const fakeBuffer = (seconds = 2) => ({
    sampleRate: 44100,
    getChannelData: () => new Float32Array(44100 * seconds),
  });

  test('detects C major → 8B', () => {
    vi.stubGlobal('Meyda', makeMeyda(cMajorChroma));
    expect(detectKey(fakeBuffer())).toBe('8B');
  });

  test('detects A minor → 1A', () => {
    vi.stubGlobal('Meyda', makeMeyda(aMinorChroma));
    expect(detectKey(fakeBuffer())).toBe('1A');
  });

  test('returns null when audio is silent (Meyda returns null every frame)', () => {
    vi.stubGlobal('Meyda', { extract: () => null });
    expect(detectKey(fakeBuffer())).toBeNull();
  });

  test('result is always a valid Camelot code', () => {
    vi.stubGlobal('Meyda', makeMeyda(cMajorChroma));
    const result = detectKey(fakeBuffer());
    expect(result).toMatch(/^\d{1,2}[AB]$/);
  });
});
