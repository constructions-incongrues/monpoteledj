# MIDI Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a hardware MIDI controller to the DJ mixer's play, fader, EQ, pitch, and loop controls via the Web MIDI API.

**Architecture:** A new `src/midi.js` module exposes pure parsing/dispatch functions (unit-testable) and an `initMidi()` function that connects to the browser MIDI API. A static mapping table (plain object, editable by the user) translates CC/Note messages to mixer actions. `main.js` calls `initMidi()` on startup. No UI beyond a small status badge in the master strip.

**Tech Stack:** Web MIDI API (`navigator.requestMIDIAccess`), ES modules, Vitest for unit tests of pure functions.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/midi.js` | Create | MIDI init, message parsing, mapping table, action dispatch |
| `src/midi.test.js` | Create | Unit tests for `parseMidiMessage` and `dispatchMidiAction` |
| `src/mixer.js` | Modify | Export `setXfaderVal`, `setChannelGain`, `setEqBand` (needed by MIDI) |
| `src/main.js` | Modify | Import and call `initMidi()` |
| `index.html` | Modify | Add MIDI status badge `#midi-status` to master strip |

---

## Task 1: Export missing setter functions from mixer.js

The MIDI module needs to set fader/EQ values without triggering DOM events. These functions don't exist yet.

**Files:**
- Modify: `src/mixer.js`

- [ ] **Step 1: Add `setXfaderVal`, `setChannelGain`, `setEqBand` to mixer.js**

Find the `xfaderVal` declaration and `applyCrossfader` function. Add these exports immediately after `adjustXfader`:

```js
export function setXfaderVal(v) {
  xfaderVal = Math.max(0, Math.min(1, v));
  applyCrossfader();
  const el = document.getElementById('xfader');
  if (el) el.value = xfaderVal;
}

export function setChannelGain(deck, v) {
  // v: 0–1
  deck.gain.gain.value = v;
  const id = deck === deckA ? 'fader-a' : 'fader-b';
  const el = document.getElementById(id);
  if (el) el.value = v;
}

export function setEqBand(deck, band, v) {
  // band: 'lo'|'mid'|'hi', v: 0–1 mapped to -12..+6 dB
  const gain = (v - 0.5) * 18; // 0→-9dB centre, 1→+9dB
  if (band === 'lo')  { deck.lo.gain.value  = gain; }
  if (band === 'mid') { deck.mid.gain.value = gain; }
  if (band === 'hi')  { deck.hi.gain.value  = gain; }
}
```

- [ ] **Step 2: Verify no existing tests break**

```bash
cd /path/to/mix && npm test
```

Expected: all 18 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/mixer.js
git commit -m "feat(midi): export setXfaderVal, setChannelGain, setEqBand"
```

---

## Task 2: Write failing tests for MIDI pure functions

**Files:**
- Create: `src/midi.test.js`

- [ ] **Step 1: Create `src/midi.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { parseMidiMessage, dispatchMidiAction } from './midi.js';

describe('parseMidiMessage', () => {
  it('parses CC message', () => {
    // status 0xB0 = CC on channel 0
    const msg = parseMidiMessage(new Uint8Array([0xB0, 7, 64]));
    expect(msg).toEqual({ type: 'cc', channel: 0, cc: 7, value: 64 });
  });

  it('parses Note On message', () => {
    // status 0x90 = Note On channel 0
    const msg = parseMidiMessage(new Uint8Array([0x90, 36, 127]));
    expect(msg).toEqual({ type: 'noteon', channel: 0, note: 36, value: 127 });
  });

  it('parses Note Off message', () => {
    // status 0x80 = Note Off channel 0
    const msg = parseMidiMessage(new Uint8Array([0x80, 36, 0]));
    expect(msg).toEqual({ type: 'noteoff', channel: 0, note: 36, value: 0 });
  });

  it('returns null for unsupported message type', () => {
    // status 0xC0 = Program Change — not supported
    const msg = parseMidiMessage(new Uint8Array([0xC0, 5]));
    expect(msg).toBeNull();
  });

  it('extracts channel from status byte', () => {
    // status 0xB3 = CC on channel 3
    const msg = parseMidiMessage(new Uint8Array([0xB3, 1, 100]));
    expect(msg.channel).toBe(3);
  });
});

describe('dispatchMidiAction', () => {
  it('calls action for matching CC mapping', () => {
    const action = vi.fn();
    const mapping = { cc: { '0:7': action } }; // channel 0, CC 7
    dispatchMidiAction({ type: 'cc', channel: 0, cc: 7, value: 64 }, mapping);
    expect(action).toHaveBeenCalledWith(64);
  });

  it('calls action for matching note mapping', () => {
    const action = vi.fn();
    const mapping = { note: { '0:36': action } }; // channel 0, note 36
    dispatchMidiAction({ type: 'noteon', channel: 0, note: 36, value: 127 }, mapping);
    expect(action).toHaveBeenCalledWith(127);
  });

  it('ignores messages with no mapping entry', () => {
    const mapping = { cc: {}, note: {} };
    // Should not throw
    expect(() => dispatchMidiAction(
      { type: 'cc', channel: 0, cc: 99, value: 0 }, mapping
    )).not.toThrow();
  });

  it('ignores null messages', () => {
    expect(() => dispatchMidiAction(null, { cc: {}, note: {} })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/midi.test.js
```

Expected: FAIL — `Cannot find module './midi.js'`

---

## Task 3: Implement `parseMidiMessage` and `dispatchMidiAction`

**Files:**
- Create: `src/midi.js`

- [ ] **Step 1: Create `src/midi.js` with pure functions**

```js
/**
 * Parse a raw MIDI message byte array.
 * Returns { type, channel, cc|note, value } or null for unsupported types.
 */
export function parseMidiMessage(data) {
  const status = data[0];
  const type = status & 0xF0;
  const channel = status & 0x0F;

  if (type === 0xB0) return { type: 'cc',      channel, cc:   data[1], value: data[2] };
  if (type === 0x90) return { type: 'noteon',  channel, note: data[1], value: data[2] };
  if (type === 0x80) return { type: 'noteoff', channel, note: data[1], value: data[2] };
  return null;
}

/**
 * Dispatch a parsed MIDI message to the matching action in the mapping.
 * mapping = { cc: { 'channel:cc': fn(value) }, note: { 'channel:note': fn(value) } }
 */
export function dispatchMidiAction(msg, mapping) {
  if (!msg) return;
  if (msg.type === 'cc') {
    const fn = mapping.cc[`${msg.channel}:${msg.cc}`];
    if (fn) fn(msg.value);
  } else if (msg.type === 'noteon' || msg.type === 'noteoff') {
    const fn = mapping.note[`${msg.channel}:${msg.note}`];
    if (fn) fn(msg.value);
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- src/midi.test.js
```

Expected: 9/9 PASS

- [ ] **Step 3: Commit**

```bash
git add src/midi.js src/midi.test.js
git commit -m "feat(midi): parseMidiMessage and dispatchMidiAction with tests"
```

---

## Task 4: Implement `initMidi` with default mapping

**Files:**
- Modify: `src/midi.js`

The default mapping targets a generic 2-deck DJ controller. CC numbers follow common conventions (Hercules DJ Control / Pioneer DDJ layout). Users can override by editing the `DEFAULT_MAPPING` object.

- [ ] **Step 1: Add imports and `initMidi` to `src/midi.js`**

Append to `src/midi.js`:

```js
import { deckA, deckB } from './audio.js';
import { togglePlay, adjustXfader, sync, setXfaderVal, setChannelGain, setEqBand } from './mixer.js';

// Default mapping — edit CC/note numbers to match your controller.
// Keys: 'channel:cc' or 'channel:note'. Value: fn(midiValue 0–127).
const norm = v => v / 127; // normalize 0–127 → 0–1

export const DEFAULT_MAPPING = {
  cc: {
    // Crossfader
    '0:54': v => setXfaderVal(norm(v)),
    // Channel faders
    '0:48': v => setChannelGain(deckA, norm(v)),
    '0:49': v => setChannelGain(deckB, norm(v)),
    // EQ deck A
    '0:40': v => setEqBand(deckA, 'hi',  norm(v)),
    '0:41': v => setEqBand(deckA, 'mid', norm(v)),
    '0:42': v => setEqBand(deckA, 'lo',  norm(v)),
    // EQ deck B
    '0:44': v => setEqBand(deckB, 'hi',  norm(v)),
    '0:45': v => setEqBand(deckB, 'mid', norm(v)),
    '0:46': v => setEqBand(deckB, 'lo',  norm(v)),
    // Pitch deck A/B
    '0:29': v => { deckA.pitch = (norm(v) - 0.5) * 24; if (deckA.audio) deckA.audio.playbackRate = 1 + deckA.pitch / 100; },
    '0:33': v => { deckB.pitch = (norm(v) - 0.5) * 24; if (deckB.audio) deckB.audio.playbackRate = 1 + deckB.pitch / 100; },
  },
  note: {
    // Play/pause deck A/B
    '0:0':  v => { if (v > 0) togglePlay('a'); },
    '0:64': v => { if (v > 0) togglePlay('b'); },
    // Sync deck A/B
    '0:4':  v => { if (v > 0) sync('a'); },
    '0:68': v => { if (v > 0) sync('b'); },
  },
};

/**
 * Connect to Web MIDI API and start routing messages.
 * Sets #midi-status badge text to reflect connection state.
 * @param {object} mapping — override DEFAULT_MAPPING if needed
 */
export async function initMidi(mapping = DEFAULT_MAPPING) {
  const badge = document.getElementById('midi-status');
  if (!navigator.requestMIDIAccess) {
    if (badge) badge.textContent = 'MIDI non supporté';
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    const connect = () => {
      let count = 0;
      access.inputs.forEach(input => {
        input.onmidimessage = e => dispatchMidiAction(parseMidiMessage(e.data), mapping);
        count++;
      });
      if (badge) badge.textContent = count > 0 ? `MIDI · ${count} entrée(s)` : 'MIDI · aucun contrôleur';
    };
    connect();
    access.onstatechange = connect;
  } catch (err) {
    if (badge) badge.textContent = 'MIDI refusé';
    console.warn('MIDI access denied:', err);
  }
}
```

- [ ] **Step 2: Run all tests to verify nothing broke**

```bash
npm test
```

Expected: 27/27 PASS (18 lib + 9 midi)

- [ ] **Step 3: Commit**

```bash
git add src/midi.js
git commit -m "feat(midi): initMidi with default CC/note mapping"
```

---

## Task 5: Add MIDI status badge to index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Find the master strip `<section class="master-strip">` and add the badge**

After the opening `<section class="master-strip">` tag, add:

```html
<span id="midi-status" style="
  font-family: var(--ma-font-display);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ma-gray-mid);
  padding: 0 12px;
  white-space: nowrap;
"></span>
```

- [ ] **Step 2: Visually verify in preview**

Open `http://127.0.0.1:5500/index.html`. The badge area is invisible until MIDI is initialized (empty string). No visual regression expected.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(midi): add #midi-status badge to master strip"
```

---

## Task 6: Wire `initMidi` in main.js

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add import and call `initMidi()`**

At the top of `src/main.js`, add the import:

```js
import { initMidi } from './midi.js';
```

At the end of `main.js`, before or after `requestAnimationFrame(animate)`:

```js
initMidi();
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: 27/27 PASS

- [ ] **Step 3: Manual test in browser**

1. Open `http://127.0.0.1:5500/index.html`
2. If no MIDI controller is connected: badge shows `MIDI · aucun contrôleur`
3. Connect a controller → badge updates to `MIDI · 1 entrée(s)`
4. Move crossfader CC → mixer crossfader moves
5. Press play note → deck A plays

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat(midi): wire initMidi in main.js"
```

---

## Adjusting the mapping for your controller

The CC/note numbers in `DEFAULT_MAPPING` are defaults for common DJ controllers. To find your controller's CC numbers:

1. Open browser DevTools console
2. Temporarily add to `initMidi`: `input.onmidimessage = e => console.log(e.data)`
3. Move each knob/fader and note the 3 bytes logged
4. Update the keys in `DEFAULT_MAPPING` accordingly

---

## Self-review

**Spec coverage:**
- ✓ Web MIDI API connection with status feedback
- ✓ Play/pause deck A & B
- ✓ Crossfader
- ✓ Channel faders A & B
- ✓ EQ (lo/mid/hi) A & B
- ✓ Pitch A & B
- ✓ Sync A & B
- ✓ Unit tests for pure functions (parseMidiMessage, dispatchMidiAction)
- ✓ Manual test instructions

**Placeholders:** None — all code blocks are complete.

**Type consistency:** `setXfaderVal`, `setChannelGain`, `setEqBand` defined in Task 1 and used in Task 4. `parseMidiMessage` and `dispatchMidiAction` defined in Task 3 and used in Task 4. Consistent throughout.
