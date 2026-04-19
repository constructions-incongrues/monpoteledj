# Full Shortcuts Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every major mixer action a keyboard shortcut and surface them in a toggleable help overlay.

**Architecture:** All shortcuts live in the single `keydown` listener in `src/main.js`. EQ kill state is tracked in a plain object local to that file. The help overlay is a `<dialog>` element in `index.html` toggled by `?`. Footer shortcuts list is updated to match.

**Tech Stack:** Vanilla JS, Web MIDI-agnostic, no new dependencies.

---

## Phase 0: Current State (reference — do not re-implement)

### Existing shortcuts (`src/main.js` lines 75-83)

| Key | Action |
|-----|--------|
| `a` / `A` | Play/pause deck A |
| `l` / `L` | Play/pause deck B |
| `←` / `→` | Crossfader −5% / +5% |
| `Space` | Pause both decks |

### Exported actions available (`src/mixer.js`)

- `togglePlay(deckId)` — play/pause
- `adjustXfader(delta)` — relative crossfader move
- `setXfaderVal(v)` — absolute crossfader (0–1)
- `sync(deckId)` — sync pitch to other deck
- `loadTrack(deckId, idx)` — load track by library index
- `deckA`, `deckB` — deck state objects; `deck.beatIndex`, `deck.hi.gain`, `deck.mid.gain`, `deck.lo.gain`

### DOM elements referenced by shortcuts

- Transport buttons: `data-action="cue|sync|load-next"` on `.transport .btn`
- EQ inputs: `#hi-a`, `#mid-a`, `#lo-a`, `#hi-b`, `#mid-b`, `#lo-b` (range −24 to +12, step 0.5)

---

## Task 1: Extend transport & crossfader shortcuts

**Files:**
- Modify: `src/main.js`

### Complete key map for this task

| Key | Action |
|-----|--------|
| `z` / `Z` | Cue deck A (beatIndex = 0) |
| `x` / `X` | Sync deck A → B |
| `c` / `C` | Load next track to deck A |
| `k` / `K` | Cue deck B |
| `j` / `J` | Sync deck B → A |
| `m` / `M` | Load next track to deck B |
| `\` | Center crossfader (setXfaderVal 0.5) |
| `Shift+←` | Coarse crossfader left (−20%) |
| `Shift+→` | Coarse crossfader right (+20%) |

- [ ] **Step 1: Add helper `nextIdx(deckId)` and extend the keydown handler**

Replace the existing `window.addEventListener('keydown', ...)` block in `src/main.js` with:

```js
function nextIdx(deckId) {
  const deck = deckId === 'a' ? deckA : deckB;
  const current = deck.track ? LIBRARY.indexOf(deck.track) : -1;
  return (current + 1) % LIBRARY.length;
}

window.addEventListener('keydown', e => {
  if (e.target.tagName === "INPUT") return;

  // Deck A transport
  if (e.key === 'a' || e.key === 'A') { togglePlay('a'); return; }
  if (e.key === 'z' || e.key === 'Z') { deckA.beatIndex = 0; return; }
  if (e.key === 'x' || e.key === 'X') { sync('a'); return; }
  if (e.key === 'c' || e.key === 'C') { loadTrack('a', nextIdx('a')); return; }

  // Deck B transport
  if (e.key === 'l' || e.key === 'L') { togglePlay('b'); return; }
  if (e.key === 'k' || e.key === 'K') { deckB.beatIndex = 0; return; }
  if (e.key === 'j' || e.key === 'J') { sync('b'); return; }
  if (e.key === 'm' || e.key === 'M') { loadTrack('b', nextIdx('b')); return; }

  // Crossfader
  if (e.key === 'ArrowLeft')  { e.shiftKey ? setXfaderVal(xfaderVal - 0.2) : adjustXfader(-0.05); return; }
  if (e.key === 'ArrowRight') { e.shiftKey ? setXfaderVal(xfaderVal + 0.2) : adjustXfader(0.05); return; }
  if (e.key === '\\') { setXfaderVal(0.5); return; }

  // Space — pause all
  if (e.key === ' ') {
    e.preventDefault();
    if (deckA.playing || deckB.playing) {
      if (deckA.playing) togglePlay('a');
      if (deckB.playing) togglePlay('b');
    }
    return;
  }
});
```

Also add `xfaderVal` and `setXfaderVal` to the mixer.js import line at the top of `main.js`:

```js
import { applyCrossfader, adjustXfader, xfaderVal, setXfaderVal, wireXfader, wireChannelFader, wireEq, wirePitch,
         loadTrack, togglePlay, sync, animate } from './mixer.js';
```

- [ ] **Step 2: Manual test in browser**

1. Open `http://127.0.0.1:5500/index.html`
2. Press `z` — deck A playhead resets to start
3. Press `x` — deck A pitch syncs to B's BPM
4. Press `c` — next track loads on deck A
5. Press `\` — crossfader jumps to center
6. Press `Shift+→` — crossfader jumps +20%

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat(shortcuts): cue, sync, load-next, crossfader center + coarse step"
```

---

## Task 2: EQ kill toggle shortcuts

EQ kills are a standard DJ technique: one keypress mutes a frequency band (sets to −24 dB), a second press restores it (0 dB). The band's slider UI must update visually.

**Files:**
- Modify: `src/main.js`

### Key map

| Key | Action |
|-----|--------|
| `1` | Toggle hi kill — deck A |
| `2` | Toggle mid kill — deck A |
| `3` | Toggle lo kill — deck A |
| `8` | Toggle hi kill — deck B |
| `9` | Toggle mid kill — deck B |
| `0` | Toggle lo kill — deck B |

### How EQ kill works

- Each EQ band has a BiquadFilterNode: `deck.hi`, `deck.mid`, `deck.lo`
- The gain property is `deck.hi.gain.value` (in dB, range −24 to +12)
- Kill = set `gain.value = -24`, restore = set `gain.value = 0`
- UI slider: `#hi-a`, `#mid-a`, `#lo-a`, `#hi-b`, `#mid-b`, `#lo-b` must be updated too

- [ ] **Step 1: Add EQ kill state and handler section inside the keydown listener**

Add this block just before `src/main.js`, after imports and before `wireXfader()`:

```js
const eqKills = {
  a: { hi: false, mid: false, lo: false },
  b: { hi: false, mid: false, lo: false },
};

function toggleEqKill(deckId, band) {
  const deck = deckId === 'a' ? deckA : deckB;
  const killed = eqKills[deckId][band];
  const targetDb = killed ? 0 : -24;
  deck[band].gain.setTargetAtTime(targetDb, ac.currentTime, 0.02);
  const el = document.getElementById(`${band}-${deckId}`);
  if (el) el.value = targetDb;
  const valEl = document.getElementById(`${band}-${deckId}-val`);
  if (valEl) valEl.textContent = (targetDb > 0 ? '+' : '') + targetDb.toFixed(0);
  eqKills[deckId][band] = !killed;
}
```

Also import `ac` from audio.js at the top of `main.js`:

```js
import { ac, deckA, deckB } from './audio.js';
```

- [ ] **Step 2: Add EQ kill keys inside the keydown listener**

Add these cases inside the `keydown` handler, before the `Space` block:

```js
  // EQ kill — deck A
  if (e.key === '1') { toggleEqKill('a', 'hi');  return; }
  if (e.key === '2') { toggleEqKill('a', 'mid'); return; }
  if (e.key === '3') { toggleEqKill('a', 'lo');  return; }

  // EQ kill — deck B
  if (e.key === '8') { toggleEqKill('b', 'hi');  return; }
  if (e.key === '9') { toggleEqKill('b', 'mid'); return; }
  if (e.key === '0') { toggleEqKill('b', 'lo');  return; }
```

- [ ] **Step 3: Manual test**

1. Play a track
2. Press `1` — highs cut out, slider moves to −24
3. Press `1` again — highs restore, slider back to 0
4. Press `8`, `9`, `0` — same behaviour on deck B

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat(shortcuts): EQ kill toggle 1/2/3 (deck A) and 8/9/0 (deck B)"
```

---

## Task 3: Help overlay (`?` key)

A `<dialog>` element with the full shortcut table. `?` toggles it open/closed. Click outside or `Escape` closes it.

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`

- [ ] **Step 1: Add dialog HTML to index.html**

Find the closing `</main>` tag and insert before it:

```html
<dialog id="shortcuts-help">
  <h3>Raccourcis clavier</h3>
  <table>
    <thead><tr><th>Touche</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td><kbd>A</kbd></td><td>Play / pause — Deck A</td></tr>
      <tr><td><kbd>Z</kbd></td><td>Cue (retour au début) — Deck A</td></tr>
      <tr><td><kbd>X</kbd></td><td>Sync tempo — Deck A</td></tr>
      <tr><td><kbd>C</kbd></td><td>Morceau suivant — Deck A</td></tr>
      <tr><td><kbd>L</kbd></td><td>Play / pause — Deck B</td></tr>
      <tr><td><kbd>K</kbd></td><td>Cue — Deck B</td></tr>
      <tr><td><kbd>J</kbd></td><td>Sync tempo — Deck B</td></tr>
      <tr><td><kbd>M</kbd></td><td>Morceau suivant — Deck B</td></tr>
      <tr><td><kbd>←</kbd> / <kbd>→</kbd></td><td>Crossfader −5% / +5%</td></tr>
      <tr><td><kbd>Shift</kbd>+<kbd>←/→</kbd></td><td>Crossfader −20% / +20%</td></tr>
      <tr><td><kbd>\</kbd></td><td>Crossfader centré</td></tr>
      <tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></td><td>Kill hi / mid / lo — Deck A</td></tr>
      <tr><td><kbd>8</kbd> <kbd>9</kbd> <kbd>0</kbd></td><td>Kill hi / mid / lo — Deck B</td></tr>
      <tr><td><kbd>Espace</kbd></td><td>Pause générale</td></tr>
      <tr><td><kbd>?</kbd></td><td>Cette aide</td></tr>
    </tbody>
  </table>
  <button id="shortcuts-close">Fermer</button>
</dialog>
```

- [ ] **Step 2: Add dialog styles to index.html `<style>` block**

Add in the `<style>` section (after existing rules):

```css
#shortcuts-help {
  background: var(--ma-black);
  color: var(--ma-white);
  border: 1px solid var(--ma-white);
  padding: 32px;
  max-width: 480px;
  width: 90vw;
}
#shortcuts-help h3 {
  font-family: var(--ma-font-display);
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin: 0 0 20px;
}
#shortcuts-help table { width: 100%; border-collapse: collapse; font-size: 13px; }
#shortcuts-help td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
#shortcuts-help td:first-child { white-space: nowrap; }
#shortcuts-help kbd {
  font-family: var(--ma-font-display);
  font-size: 11px;
  padding: 1px 5px;
  border: 1px solid rgba(255,255,255,0.4);
}
#shortcuts-help button {
  margin-top: 20px;
  font-family: var(--ma-font-display);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: none;
  color: var(--ma-white);
  border: 1px solid var(--ma-white);
  padding: 6px 14px;
  cursor: pointer;
}
#shortcuts-help::backdrop { background: rgba(0,0,0,0.75); }
```

- [ ] **Step 3: Add `?` toggle and close handler in `src/main.js`**

Add inside the `keydown` listener (first check, before the INPUT guard, so it works from input focus too):

```js
  if (e.key === '?') {
    const dlg = document.getElementById('shortcuts-help');
    dlg.open ? dlg.close() : dlg.showModal();
    return;
  }
```

Also add the close-button and backdrop-click handlers (after the keydown listener):

```js
document.getElementById('shortcuts-close').addEventListener('click', () =>
  document.getElementById('shortcuts-help').close());

document.getElementById('shortcuts-help').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
```

- [ ] **Step 4: Manual test**

1. Press `?` — dialog appears over the mixer
2. Press `Escape` — dialog closes (native dialog behaviour)
3. Click outside dialog — closes
4. Click "Fermer" button — closes
5. Press `?` again — reopens

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.js
git commit -m "feat(shortcuts): help overlay on ? key with full shortcut table"
```

---

## Task 4: Update footer shortcut reference

Replace the stale footer list with the complete set.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the Raccourcis `<p>` block**

Find (around line 1296):

```html
    <p>
      <kbd>A</kbd>&nbsp;/&nbsp;<kbd>L</kbd>&nbsp;— play deck A&nbsp;/&nbsp;B<br>
      <kbd>←</kbd>&nbsp;/&nbsp;<kbd>→</kbd>&nbsp;— crossfader<br>
      <kbd>R</kbd>&nbsp;— enregistrer la session<br>
      <kbd>Espace</kbd>&nbsp;— tout mettre en pause
    </p>
```

Replace with:

```html
    <p>
      <kbd>A</kbd>&nbsp;/&nbsp;<kbd>L</kbd>&nbsp;— play deck A&nbsp;/&nbsp;B<br>
      <kbd>Z</kbd>&nbsp;/&nbsp;<kbd>K</kbd>&nbsp;— cue A&nbsp;/&nbsp;B<br>
      <kbd>X</kbd>&nbsp;/&nbsp;<kbd>J</kbd>&nbsp;— sync A&nbsp;/&nbsp;B<br>
      <kbd>C</kbd>&nbsp;/&nbsp;<kbd>M</kbd>&nbsp;— morceau suivant A&nbsp;/&nbsp;B<br>
      <kbd>←</kbd>&nbsp;/&nbsp;<kbd>→</kbd>&nbsp;— crossfader&nbsp;·&nbsp;<kbd>\</kbd>&nbsp;centré<br>
      <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>&nbsp;/&nbsp;<kbd>8</kbd><kbd>9</kbd><kbd>0</kbd>&nbsp;— kill EQ A&nbsp;/&nbsp;B<br>
      <kbd>Espace</kbd>&nbsp;— pause générale&nbsp;·&nbsp;<kbd>?</kbd>&nbsp;— aide
    </p>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "docs: update footer shortcut reference to match full key map"
```

---

## Self-review

**Spec coverage:**
- ✓ Play/pause A & B (existing, preserved)
- ✓ Cue A & B (beatIndex reset)
- ✓ Sync A & B
- ✓ Load next track A & B
- ✓ Crossfader fine step (existing), coarse step (Shift+arrow), center (\)
- ✓ EQ kill toggle hi/mid/lo per deck (1/2/3, 8/9/0)
- ✓ Pause all (Space, existing)
- ✓ Help overlay with full table (?)
- ✓ Footer reference updated

**No placeholders.** All code is complete and copy-ready.

**Type consistency:** `nextIdx` returns `number`, passed to `loadTrack(deckId, idx)` which expects `number`. `toggleEqKill` reads `deck[band].gain` — verified `deck.hi`, `deck.mid`, `deck.lo` are BiquadFilterNodes (from `audio.js` makeDeck). `xfaderVal` is the exported `let` from `mixer.js`, accessible as a live binding.
