// ─────────────────────────────────────────────────────────────────────────────
// Mode Flemme — single deck + autoplay
// ─────────────────────────────────────────────────────────────────────────────
import { deckA, ac } from './audio.js';
import { LIBRARY, markFilter } from './library.js';
import { loadTrack, togglePlay } from './mixer.js';

// ── State ────────────────────────────────────────────────────────────────────
export let flemmeMode = false;
export let flemmePlaylist = [];  // indices of tracks to play
export let flemmeIndex = 0;

let _scheduleTimer = null;
const CROSSFADE_LEAD = 6; // seconds before end to start fade

// ── Enable / Disable ─────────────────────────────────────────────────────────
export function enableFlemme() {
  flemmeMode = true;
  document.body.classList.add('flemme-mode');

  // Build playlist: marked tracks if filter active, else all tracks with marks > 0, else all
  flemmePlaylist = LIBRARY
    .map((t, i) => ({ track: t, idx: i }))
    .filter(({ track }) => {
      if (markFilter > 0) return track.marks === markFilter;
      if (markFilter === -1) return track.marks > 0;
      return track.marks > 0; // default: all marked
    })
    .map(({ idx }) => idx);

  // Fallback: if no marked tracks, use entire library
  if (flemmePlaylist.length === 0) {
    flemmePlaylist = LIBRARY.map((_, i) => i);
  }

  // Shuffle playlist for variety
  _shuffle(flemmePlaylist);

  flemmeIndex = 0;

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

  flemmeIndex = (flemmeIndex + 1) % flemmePlaylist.length;
  const nextIdx = flemmePlaylist[flemmeIndex];

  console.log('[flemme] Playing next:', nextIdx, LIBRARY[nextIdx]?.title);

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
