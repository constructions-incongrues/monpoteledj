# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test          # run all tests once (vitest run)
npm run test:watch  # vitest in watch mode
```

To run a single test file or filter by name:
```bash
npx vitest run src/lib.test.js
npx vitest run -t "detectKey"
```

The app has no build step — it runs directly in the browser via a local HTTP server (e.g. VS Code Live Server at `http://127.0.0.1:5500/index.html`).

## Architecture

This is a single-page DJ mixer app. The entry point is `index.html`, which loads `src/main.js` as an ES module.

### Module dependency graph (no cycles)

```
lib.js          ← no deps (pure functions)
audio.js        ← no local deps
library.js      ← lib.js
mixer.js        ← audio.js + library.js + lib.js
main.js         ← audio.js + library.js + mixer.js
```

### Module responsibilities

- **`src/lib.js`** — Pure functions only: `fixBadEscapes` (repairs invalid JSON escape sequences from the API), `mapPost` (maps raw API post to track object), `detectBpm` (wraps `MusicTempo` CDN global), `detectKey` (Meyda chroma + Krumhansl-Schmuckler Pearson correlation → Camelot notation). All 4 are tested in `src/lib.test.js`.

- **`src/audio.js`** — WebAudio graph setup. Exports `ac` (AudioContext), `deckA`/`deckB` (deck state objects), `masterAnalyser`, and functions: `makeDeck`, `attachAudio`, `scheduleDeck`, `stopDeck`, `playBeat`, `keyToHz`. Each deck has a 3-band EQ → gain → analyser → xfaderGain → masterGain chain, plus a parallel FX send bus.

- **`src/library.js`** — Data layer. `LIBRARY` is `export let` (live binding — reassigned by `fetchLibrary`, visible to all importers). Fetches from `https://www.musiqueapproximative.net/posts?format=json`, applies `fixBadEscapes` before `JSON.parse` (the API returns malformed JSON with bare backslashes). `renderLibrary` and `populateContribFilter` manipulate the DOM table directly.

- **`src/mixer.js`** — UI controls and playback logic. `xfaderVal` is `export let` — mutated locally; importers use `adjustXfader(delta)` to change it. Contains top-level side-effect calls (`buildMeter(...)`) that run when the module is first imported. `analyzeTrack` fires-and-forgets: fetches + decodes audio, runs `detectBpm`/`detectKey`, updates `LIBRARY[trackIdx]` and DOM in place.

- **`src/main.js`** — Entry point. Wires all controls, attaches event listeners, calls the init IIFE (`fetchLibrary` → `renderLibrary` → `loadTrack`), kicks off `requestAnimationFrame(animate)`. Reads `window.TWEAK_DEFAULTS` which is set by a small inline `<script>` in `index.html` (uses `var` so it's accessible from the module scope).

### Key data flow

1. `fetchLibrary()` populates `LIBRARY` array (live binding)
2. `loadTrack(deckId, trackIdx)` sets `deck.track`, calls `attachAudio` (creates `HTMLAudioElement` → `createMediaElementSource` → deck WebAudio graph), then fires `analyzeTrack` async
3. `togglePlay` calls `scheduleDeck` which either calls `audio.play()` (real MP3) or starts the oscillator synthesizer fallback (for tracks without a URL)
4. `animate()` runs via `requestAnimationFrame` loop: updates VU meters + playhead positions every frame

### CDN globals (loaded in `<head>` of index.html)

- `MusicTempo` — from `music-tempo@1.0.3` — used in `detectBpm`
- `Meyda` — from `meyda@5.6.3` — used in `detectKey` for chroma extraction

Both are accessed as `globalThis.MusicTempo` / `globalThis.Meyda` in `lib.js` so they can be mocked with `vi.stubGlobal` in tests.

### TWEAK_DEFAULTS / editmode

The `/*EDITMODE-BEGIN*/` … `/*EDITMODE-END*/` markers in `index.html` are used by the musiqueapproximative.net CMS to inject editable values. Do not remove or reformat these markers.
