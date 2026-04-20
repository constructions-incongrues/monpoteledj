// ─────────────────────────────────────────────────────────────────────────────
// Mode Flemme — single deck + autoplay
// ─────────────────────────────────────────────────────────────────────────────
import { deckA, ac } from './audio.js';
import { LIBRARY, markFilter, renderFlemmePlaylist, updateFlemmeHighlight, updateFlemmeNav } from './library.js';
import { loadTrack, togglePlay } from './mixer.js';

// ── State ────────────────────────────────────────────────────────────────────
export let flemmeMode = false;
export let flemmePlaylist = [];  // indices of tracks to play
export let flemmeIndex = 0;
export let flemmeHighlight = 0;
export function setFlemmeIndex(i) { flemmeIndex = i; }

export function navigateFlemme(dir) {
  if (!flemmeMode || flemmePlaylist.length === 0) return;
  flemmeHighlight = (flemmeHighlight + dir + flemmePlaylist.length) % flemmePlaylist.length;
  updateFlemmeNav(flemmeHighlight);
}

export function loadFlemmeHighlighted() {
  if (!flemmeMode || flemmePlaylist.length === 0) return;
  flemmeIndex = flemmeHighlight;
  const idx = flemmePlaylist[flemmeHighlight];
  loadTrack('a', idx);
  updateFlemmeHighlight(flemmeHighlight);
  setTimeout(() => {
    if (deckA.audio && deckA.audio.paused) togglePlay('a');
  }, 100);
}

let _scheduleTimer = null;
const CROSSFADE_LEAD = 6; // seconds before end to start fade

// ── Enable / Disable ─────────────────────────────────────────────────────────
export function enableFlemme() {
  flemmeMode = true;
  document.body.classList.add('flemme-mode');

  // Build playlist: tracks marked 1, fallback to 50 random
  flemmePlaylist = LIBRARY
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => Number(t.mark ?? 0) === 1)
    .map(({ i }) => i);

  if (flemmePlaylist.length === 0) {
    const all = LIBRARY.map((_, i) => i);
    _shuffle(all);
    flemmePlaylist = all.slice(0, 50);
  }

  flemmeIndex = 0;
  flemmeHighlight = 0;

  // Render playlist panel
  renderFlemmePlaylist(flemmePlaylist, 0);
  updateFlemmeNav(0);

  // Load and play first track
  const firstIdx = flemmePlaylist[0];
  loadTrack('a', firstIdx);

  // Wait a tick for audio element to be ready, then play
  setTimeout(() => {
    if (deckA.audio && deckA.audio.paused) {
      togglePlay('a');
    }
    _scheduleNext();
  }, 100);

  console.log('[flemme] Mode enabled, playlist:', flemmePlaylist.length, 'tracks');
}

export function disableFlemme() {
  flemmeMode = false;
  document.body.classList.remove('flemme-mode');
  clearTimeout(_scheduleTimer);
  _scheduleTimer = null;
  console.log('[flemme] Mode disabled');
}

export function toggleFlemme() {
  if (flemmeMode) disableFlemme();
  else enableFlemme();
}

// ── Internal scheduling ──────────────────────────────────────────────────────
function _scheduleNext() {
  if (!flemmeMode) return;
  clearTimeout(_scheduleTimer);

  if (!deckA.audio || !deckA.audio.duration) {
    // Audio not ready yet, retry later
    _scheduleTimer = setTimeout(_scheduleNext, 500);
    return;
  }

  const remaining = deckA.audio.duration - deckA.audio.currentTime;

  if (remaining > CROSSFADE_LEAD + 1) {
    // Schedule check closer to the end
    const delay = (remaining - CROSSFADE_LEAD) * 1000;
    _scheduleTimer = setTimeout(_scheduleNext, Math.min(delay, 5000));
  } else if (remaining > 0.5) {
    // Start fade and prepare next
    _playNext();
  } else {
    // Track ended, immediate next
    _playNext();
  }
}

function _playNext() {
  if (!flemmeMode) return;

  const nextPos = flemmeIndex + 1;

  // End of playlist → reload with 50 new random tracks
  if (nextPos >= flemmePlaylist.length) {
    const all = LIBRARY.map((_, i) => i);
    _shuffle(all);
    flemmePlaylist = all.slice(0, 50);
    flemmeIndex = 0;
    flemmeHighlight = 0;
    renderFlemmePlaylist(flemmePlaylist, 0);
    updateFlemmeNav(0);
  } else {
    flemmeIndex = nextPos;
  }

  const nextIdx = flemmePlaylist[flemmeIndex];
  updateFlemmeHighlight(flemmeIndex);

  // Fade out current
  const currentGain = deckA.gain.gain;
  currentGain.setTargetAtTime(0, ac.currentTime, 1.5);

  // After fade, load next and play
  setTimeout(() => {
    loadTrack('a', nextIdx);
    currentGain.setTargetAtTime(1, ac.currentTime, 0.3);

    setTimeout(() => {
      if (deckA.audio && deckA.audio.paused && flemmeMode) {
        togglePlay('a');
      }
      _scheduleNext();
    }, 100);
  }, 2000);
}

// ── Listen to track ending ───────────────────────────────────────────────────
// This is called from mixer.js when audio 'ended' fires
export function onTrackEnded() {
  if (flemmeMode) {
    _playNext();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
