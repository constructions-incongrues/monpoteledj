import { deckA, deckB } from './audio.js';
import { fetchLibrary, LIBRARY, renderLibrary, renderPlaylists, populateContribFilter, cycleMark, unmarkTrack, markFilter, setSearchMode } from './library.js';
import { applyCrossfader, adjustXfader, wireXfader, wireChannelFader, wireEq, wirePitch,
         loadTrack, togglePlay, sync, animate, wireWaveSeek,
         toggleFullscreen, navigateHighlight, loadHighlighted, highlightFirst, fullscreenMode, highlightedIdx,
         xfaderVal } from './mixer.js';
import { initMidi } from './midi.js';

// ── Active deck state ──────────────────────────────────────────────────────
let activeDeck = 'a'; // 'a' | 'b' — persistent selection

function setActiveDeck(id) {
  activeDeck = id;
  document.querySelectorAll('.deck').forEach(d =>
    d.classList.toggle('deck-active', d.dataset.side === id));
}

// ── EQ Kill state ──────────────────────────────────────────────────────────
const _eqKill = { a: { hi: null, mid: null, lo: null },
                  b: { hi: null, mid: null, lo: null } };

function toggleEqKill(deckId, band) {
  const input = document.getElementById(`${band}-${deckId}`);
  if (!input) return;
  const min = parseFloat(input.min); // −24
  const current = parseFloat(input.value);
  if (current > min) {
    _eqKill[deckId][band] = current;
    input.value = min;
  } else {
    input.value = _eqKill[deckId][band] ?? 0;
    _eqKill[deckId][band] = null;
  }
  input.dispatchEvent(new Event('input'));
}

wireXfader();
setActiveDeck('a'); // initialise l'indicateur visuel au chargement
wireChannelFader('fader-a', deckA);
wireChannelFader('fader-b', deckB);
wireEq('a', deckA);
wireEq('b', deckB);
wirePitch('a', deckA);
wirePitch('b', deckB);
wireWaveSeek('a', deckA);
wireWaveSeek('b', deckB);
applyCrossfader();

document.getElementById('library-search').addEventListener('input', e =>
  renderLibrary(e.target.value, document.getElementById('contrib-filter').value));

document.getElementById('search-modes').addEventListener('click', e => {
  const btn = e.target.closest('.smode-btn');
  if (!btn) return;
  _focusSearch(btn.dataset.mode);
});

function applyMarkFilter(marks) {
  document.querySelectorAll('.mark-filter-btn').forEach(b => {
    b.classList.toggle('active', marks !== 0 && parseInt(b.dataset.marks) === marks);
  });
  renderLibrary(document.getElementById('library-search').value,
                document.getElementById('contrib-filter').value,
                marks);
}

['mark-filters', 'lib-mark-filters'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e => {
    const btn = e.target.closest('.mark-filter-btn');
    if (!btn) return;
    applyMarkFilter(parseInt(btn.dataset.marks));
  });
});

document.getElementById('library-body').addEventListener('click', e => {
  const b = e.target.closest('[data-load]');
  if (b) { loadTrack(b.dataset.load, parseInt(b.dataset.idx)); e.stopPropagation(); return; }
  const td = e.target.closest('td[data-contrib]');
  if (td) {
    const contrib = td.dataset.contrib;
    const sel = document.getElementById('contrib-filter');
    sel.value = contrib;
    renderLibrary(document.getElementById('library-search').value, contrib, markFilter);
    if (!fullscreenMode) toggleFullscreen();
  }
});

document.getElementById('playlists').addEventListener('click', e => {
  const b = e.target.closest('[data-load]');
  if (b) { loadTrack(b.dataset.load, parseInt(b.dataset.idx)); e.stopPropagation(); }
});

document.getElementById('library-body').addEventListener('dblclick', e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const idx = parseInt(tr.dataset.idx);
  if (!deckA.track) loadTrack('a', idx);
  else if (!deckB.track) loadTrack('b', idx);
  else loadTrack('a', idx);
});

document.querySelectorAll('.transport .btn').forEach(b => {
  b.addEventListener('click', () => {
    const action = b.dataset.action, deckId = b.dataset.deck;
    if (action === 'play') togglePlay(deckId);
    else if (action === 'sync') { sync(deckId); b.classList.add('active'); setTimeout(()=>b.classList.remove('active'), 300); }
    else if (action === 'cue') {
      const deck = deckId==='a'?deckA:deckB;
      deck.beatIndex = 0;
      b.classList.add('active'); setTimeout(()=>b.classList.remove('active'), 200);
    }
    else if (action === 'load-next') {
      const deck = deckId==='a'?deckA:deckB;
      const currentIdx = deck.track ? LIBRARY.indexOf(deck.track) : -1;
      const next = (currentIdx + 1) % LIBRARY.length;
      loadTrack(deckId, next);
    }
  });
});

document.querySelectorAll('.loop-buttons').forEach(grid => {
  const deckId = grid.dataset.deck;
  const deck = deckId==='a'?deckA:deckB;
  grid.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const bars = parseFloat(b.dataset.bars);
      if (deck.loopActive && deck.loopBars === bars) {
        deck.loopActive = false; deck.loopBars = 0;
        b.classList.remove('on');
      } else {
        grid.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
        deck.loopActive = true; deck.loopBars = bars;
        b.classList.add('on');
      }
    });
  });
});

document.querySelectorAll('.headphone').forEach(h => {
  h.addEventListener('click', () => { h.classList.toggle('on'); });
});



// Keyboard vs mouse: suppress hover styles during keyboard navigation
window.addEventListener('keydown', () => document.body.classList.add('using-keyboard'), true);
window.addEventListener('mousemove', () => document.body.classList.remove('using-keyboard'), { passive: true });

let _percentTimestamp = 0;

// Search mode state machine: "/" alone = global, "/a" = artist, "/t" = title, "/c" = contrib
let _awaitingSearchMode = false;
let _awaitingSearchTimer = null;

function _focusSearch(mode) {
  _awaitingSearchMode = false;
  clearTimeout(_awaitingSearchTimer);
  setSearchMode(mode);
  document.querySelectorAll('.smode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
  if (!fullscreenMode) toggleFullscreen();
  const s = document.getElementById('library-search');
  requestAnimationFrame(() => { s.focus(); s.select(); });
}

window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) return;

  // ? — toggle help dialog (works even from input)
  if (e.key === '?') {
    const dlg = document.getElementById('shortcuts-help');
    dlg.open ? dlg.close() : dlg.showModal();
    return;
  }

  // "/" — start search mode selection; next key selects field (a/t/c), timeout = global
  if (e.key === '/' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    _awaitingSearchMode = true;
    clearTimeout(_awaitingSearchTimer);
    _awaitingSearchTimer = setTimeout(() => _focusSearch('all'), 600);
    if (!fullscreenMode) toggleFullscreen();
    return;
  }

  // "/a" artiste · "/t" titre · "/c" contributeur
  if (_awaitingSearchMode && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    const modes = { a: 'artist', t: 'title', c: 'contrib' };
    _focusSearch(modes[e.key] || 'all');
    return;
  }

  if (e.target.tagName === "INPUT" && e.key !== "Escape") {
    // In fullscreen search mode, allow arrow keys and Enter
    if (fullscreenMode && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
      // Continue to handle below
    } else {
      return;
    }
  }

  // EQ Kill 1/2/3 — deck actif (toggle)
  const EQ_KILL_KEYS = { '1': 'hi', '2': 'mid', '3': 'lo' };
  if (EQ_KILL_KEYS[e.key] && !e.shiftKey) {
    toggleEqKill(activeDeck, EQ_KILL_KEYS[e.key]);
    return;
  }

  // Fullscreen mode navigation
  if (fullscreenMode) {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      navigateHighlight(1);
      return;
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      navigateHighlight(-1);
      return;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetDeck = e.shiftKey ? (activeDeck === 'a' ? 'b' : 'a') : activeDeck;
      loadHighlighted(targetDeck);
      toggleFullscreen();
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const searchEl = document.getElementById('library-search');
      if (document.activeElement === searchEl) {
        searchEl.blur(); // just unfocus, stay in fullscreen
      } else {
        toggleFullscreen();
      }
      return;
    }
  }

  // ESC hors fullscreen : ferme la biblio si ouverte
  if (e.key === 'Escape' && fullscreenMode) {
    e.preventDefault();
    toggleFullscreen();
  }

  // Shift+A/B — sélectionner deck actif · Shift+L — toggle bibliothèque
  if (e.shiftKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    applyMarkFilter(0);
    setActiveDeck('a');
    return;
  }
  if (e.shiftKey && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault();
    applyMarkFilter(0);
    setActiveDeck('b');
    return;
  }
  if (e.shiftKey && (e.key === 'l' || e.key === 'L')) {
    e.preventDefault();
    applyMarkFilter(0);
    toggleFullscreen();
    return;
  }

  // Shift+1-5: filter library by mark color; Shift+0 = show all
  if (e.shiftKey && ['Digit0','Digit1','Digit2','Digit3','Digit4','Digit5'].includes(e.code)) {
    const marks = e.code === 'Digit0' ? 0 : parseInt(e.code.replace('Digit', ''));
    applyMarkFilter(marks);
    if (marks !== 0) {
      if (!fullscreenMode) toggleFullscreen();
      highlightFirst();
    }
    return;
  }

  // Mark / unmark track (s = cycle color, Shift+S = unmark)
  if (e.key === 's' || e.key === 'S') {
    const idx = highlightedIdx >= 0 ? highlightedIdx
               : (deckA.track ? LIBRARY.indexOf(deckA.track) : -1);
    if (idx >= 0) {
      if (e.shiftKey) unmarkTrack(idx);
      else cycleMark(idx);
    }
    return;
  }

  // Normal playback controls
  if (e.key === 'a' || e.key === 'A') {
    togglePlay('a');
  } else if (e.key === 'l' || e.key === 'L') {
    togglePlay('b');
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    adjustXfader(e.shiftKey ? -0.01 : -0.05);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    adjustXfader(e.shiftKey ? 0.01 : 0.05);
  } else if (e.key === ' ') {
    e.preventDefault();
    togglePlay(activeDeck);
  } else if (e.key === 'z') {
    sync(activeDeck);
  } else if (e.key === 'c' && !e.shiftKey) {
    const deck = activeDeck === 'a' ? deckA : deckB;
    deck.beatIndex = 0;
  } else if (e.key === 'v' && !e.shiftKey) {
    const deck = activeDeck === 'a' ? deckA : deckB;
    const currentIdx = deck.track ? LIBRARY.indexOf(deck.track) : -1;
    const next = (currentIdx + 1) % LIBRARY.length;
    loadTrack(activeDeck, next);
  } else if (e.key === 'x') {
    adjustXfader(0.5 - xfaderVal);
  }
});

// Shortcuts help dialog handlers
document.getElementById('shortcuts-close')?.addEventListener('click', () =>
  document.getElementById('shortcuts-help').close());
document.getElementById('shortcuts-help')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

function applyTweaks(t) {
  document.body.classList.toggle('invert', !!t.invertRig);
  document.getElementById('tw-invert').classList.toggle('on', !!t.invertRig);
  const twSession = document.getElementById('tw-session');
  if (twSession) twSession.value = t.sessionName || "";
}
let tweaks = { ...(window.TWEAK_DEFAULTS || {}) };
applyTweaks(tweaks);

function setTweak(k, v) {
  tweaks[k] = v;
  applyTweaks(tweaks);
  try { window.parent.postMessage({type:'__edit_mode_set_keys', edits:{[k]:v}}, '*'); } catch(e){}
}
// Contrib in decks: click to open library filtered by contributor
['a', 'b'].forEach(side => {
  document.getElementById(`contrib-${side}`).addEventListener('click', () => {
    const contrib = document.getElementById(`contrib-${side}`).textContent.trim();
    if (!contrib || contrib === '—') return;
    const sel = document.getElementById('contrib-filter');
    sel.value = contrib;
    renderLibrary(document.getElementById('library-search').value, contrib, markFilter);
    if (!fullscreenMode) toggleFullscreen();
  });
});

document.getElementById('tw-invert').addEventListener('click', () => setTweak('invertRig', !tweaks.invertRig));
document.getElementById('tw-library').addEventListener('click', () => toggleFullscreen());
document.getElementById('tw-session').addEventListener('input', e => setTweak('sessionName', e.target.value));

window.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === '__activate_edit_mode') document.getElementById('tweaks').classList.add('visible');
  else if (d.type === '__deactivate_edit_mode') document.getElementById('tweaks').classList.remove('visible');
});
try { window.parent.postMessage({type:'__edit_mode_available'}, '*'); } catch(e){}

// Easter egg: Shift+S · Shift+O · Shift+S → sos.musiqueapproximative.net
const _SOS = ['S', 'O', 'S'];
let _sosStep = 0, _sosTimer = null;
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (!e.shiftKey || (e.key !== 'S' && e.key !== 'O')) {
    if (_sosStep > 0) { clearTimeout(_sosTimer); _sosStep = 0; }
    return;
  }
  clearTimeout(_sosTimer);
  if (e.key === _SOS[_sosStep]) {
    _sosStep++;
    if (_sosStep === _SOS.length) {
      _sosStep = 0;
      window.open('https://sos.musiqueapproximative.net', '_blank');
    } else {
      _sosTimer = setTimeout(() => { _sosStep = 0; }, 2000);
    }
  } else {
    _sosStep = (e.key === _SOS[0]) ? 1 : 0;
    if (_sosStep > 0) _sosTimer = setTimeout(() => { _sosStep = 0; }, 2000);
  }
});

requestAnimationFrame(animate);
initMidi();
(async () => {
  await fetchLibrary();
  renderLibrary();
  renderPlaylists();
  populateContribFilter();
  if (LIBRARY.length > 0) loadTrack('a', 0);
  if (LIBRARY.length > 1) loadTrack('b', 1);
})();
