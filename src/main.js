import { deckA, deckB } from './audio.js';
import { fetchLibrary, LIBRARY, renderLibrary, renderPlaylists, populateContribFilter, cycleMark, unmarkTrack, markFilter, setSearchMode, updateFlemmeHighlight } from './library.js';
import { toggleFlemme, flemmeMode, flemmePlaylist, flemmeIndex, setFlemmeIndex, navigateFlemme, loadFlemmeHighlighted } from './flemme.js';
import { applyCrossfader, adjustXfader, wireXfader, wireChannelFader, wireEq, wirePitch,
         loadTrack, togglePlay, sync, animate, wireWaveSeek,
         toggleFullscreen, navigateHighlight, loadHighlighted, highlightFirst, fullscreenMode, highlightedIdx,
         xfaderVal } from './mixer.js';
import { initMidi } from './midi.js';

// ── Status bar updater ─────────────────────────────────────────────────────
function updateStatusBar() {
  const deck = activeDeck === 'a' ? deckA : deckB;
  const track = deck.track;
  const bpm = track?.bpm ?? null;
  const key = track?.key ?? null;
  const isFlemme = document.body.classList.contains('flemme-mode');
  const mode = isFlemme ? 'Flemme' : 'Cyber Tournetablisme';
  
  window.updateStatusBar?.(bpm, key, mode);
}

// ── Active deck state ──────────────────────────────────────────────────────
let activeDeck = 'a'; // 'a' | 'b' — persistent selection

function setActiveDeck(id) {
  activeDeck = id;
  document.querySelectorAll('.deck').forEach(d =>
    d.classList.toggle('deck-active', d.dataset.side === id));
  updateStatusBar();
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

// ── Command Palette ────────────────────────────────────────────────────────
const COMMAND_PALETTE_STATS_KEY = 'commandPaletteStats';

const COMMANDS = [
  { id: 'play-a',      section: 'Transport',   name: 'Play / Pause Deck A',      desc: 'Lance ou stoppe immédiatement le deck A.', aliases: ['deck a', 'lecture a', 'pause a'], key: 'A',          action: () => togglePlay('a') },
  { id: 'play-b',      section: 'Transport',   name: 'Play / Pause Deck B',      desc: 'Lance ou stoppe immédiatement le deck B.', aliases: ['deck b', 'lecture b', 'pause b'], key: 'L',          action: () => togglePlay('b') },
  { id: 'play-active', section: 'Transport',   name: 'Play / Pause deck actif',  desc: 'Contrôle le deck actuellement sélectionné.', aliases: ['deck actif', 'play', 'pause'], key: 'Espace',     action: () => togglePlay(activeDeck) },
  { id: 'sync-active', section: 'Transport',   name: 'Sync tempo',               desc: 'Aligne le tempo du deck actif.', aliases: ['sync', 'tempo', 'bpm'], key: 'Z',          action: () => sync(activeDeck) },
  { id: 'cue-active',  section: 'Transport',   name: 'Cue (retour début)',       desc: 'Replace la lecture du deck actif au début.', aliases: ['cue', 'retour', 'debut'], key: 'C',          action: () => { (activeDeck === 'a' ? deckA : deckB).beatIndex = 0; } },
  { id: 'next-active', section: 'Transport',   name: 'Morceau suivant',          desc: 'Charge le morceau suivant sur le deck actif.', aliases: ['suivant', 'next', 'track'], key: 'V',          action: () => { const dk = activeDeck === 'a' ? deckA : deckB; const i = dk.track ? LIBRARY.indexOf(dk.track) : -1; loadTrack(activeDeck, (i + 1) % LIBRARY.length); updateStatusBar(); } },
  { id: 'select-a',    section: 'Decks',       name: 'Sélectionner Deck A',      desc: 'Passe le focus de contrôle au deck A.', aliases: ['focus a', 'actif a'], key: 'Shift+A',    action: () => setActiveDeck('a') },
  { id: 'select-b',    section: 'Decks',       name: 'Sélectionner Deck B',      desc: 'Passe le focus de contrôle au deck B.', aliases: ['focus b', 'actif b'], key: 'Shift+B',    action: () => setActiveDeck('b') },
  { id: 'flemme',      section: 'Modes',       name: 'Mode Flemme (autoplay)',   desc: 'Active le mode lecture simplifiée automatique.', aliases: ['autoplay', 'flemme', 'mode'], key: 'F',          action: () => { toggleFlemme(); updateStatusBar(); } },
  { id: 'xfade-left',  section: 'Mix',         name: 'Crossfader vers A (−5%)',  desc: 'Décale le crossfader de 5% vers le deck A.', aliases: ['crossfader', 'gauche', 'mix'], key: '←',          action: () => adjustXfader(-0.05) },
  { id: 'xfade-right', section: 'Mix',         name: 'Crossfader vers B (+5%)',  desc: 'Décale le crossfader de 5% vers le deck B.', aliases: ['crossfader', 'droite', 'mix'], key: '→',          action: () => adjustXfader(0.05) },
  { id: 'xfade-center',section: 'Mix',         name: 'Crossfader centré',        desc: 'Replace le crossfader exactement au centre.', aliases: ['crossfader centre', 'center', 'milieu'], key: 'X',          action: () => adjustXfader(0.5 - xfaderVal) },
  { id: 'kill-hi',     section: 'EQ',          name: 'Kill EQ Hi',               desc: 'Coupe instantanément les hautes fréquences.', aliases: ['eq hi', 'high', 'aigus'], key: '1',          action: () => toggleEqKill(activeDeck, 'hi') },
  { id: 'kill-mid',    section: 'EQ',          name: 'Kill EQ Mid',              desc: 'Coupe instantanément les médiums.', aliases: ['eq mid', 'medium', 'mediums'], key: '2',          action: () => toggleEqKill(activeDeck, 'mid') },
  { id: 'kill-lo',     section: 'EQ',          name: 'Kill EQ Lo',               desc: 'Coupe instantanément les basses.', aliases: ['eq lo', 'low', 'basses'], key: '3',          action: () => toggleEqKill(activeDeck, 'lo') },
  { id: 'search',      section: 'Collections', name: 'Rechercher dans les collections', desc: 'Place le focus dans la recherche des collections.', aliases: ['recherche', 'search', 'library', 'librairie', 'bibliotheque', 'collections'], key: '/',          action: () => _focusSearch('all') },
  { id: 'library',     section: 'Collections', name: 'Ouvrir / fermer les collections', desc: 'Bascule les collections en plein écran.', aliases: ['fullscreen', 'bibliotheque', 'plein ecran', 'collections'], key: 'Shift+L',    action: () => toggleFullscreen() },
  { id: 'help',        section: 'Aide',        name: 'Ouvrir les raccourcis clavier', desc: 'Affiche l’aide complète des raccourcis.', aliases: ['aide', 'help', 'raccourcis', 'shortcut'], key: '?',      action: () => document.getElementById('shortcuts-help').showModal() },
];
let _cmdSelectedIdx = 0;

function _loadCommandPaletteStats() {
  try {
    const raw = localStorage.getItem(COMMAND_PALETTE_STATS_KEY);
    if (!raw) return { recentIds: [], counts: {} };
    const parsed = JSON.parse(raw);
    return {
      recentIds: Array.isArray(parsed?.recentIds) ? parsed.recentIds : [],
      counts: parsed?.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
    };
  } catch {
    return { recentIds: [], counts: {} };
  }
}

function _saveCommandPaletteStats(stats) {
  try {
    localStorage.setItem(COMMAND_PALETTE_STATS_KEY, JSON.stringify(stats));
  } catch {}
}

function _recordCommandUsage(commandId) {
  if (!commandId) return;
  const stats = _loadCommandPaletteStats();
  stats.recentIds = [commandId, ...stats.recentIds.filter(id => id !== commandId)].slice(0, 5);
  stats.counts[commandId] = (stats.counts[commandId] || 0) + 1;
  _saveCommandPaletteStats(stats);
}

function _getContextualCommands() {
  const otherDeck = activeDeck === 'a' ? 'b' : 'a';
  const otherDeckLabel = otherDeck.toUpperCase();
  const collectionsOpen = Boolean(fullscreenMode);
  const isFlemme = Boolean(flemmeMode);

  return [
    {
      id: 'context-library',
      section: 'Contexte',
      name: collectionsOpen ? 'Fermer les collections' : 'Ouvrir les collections',
      desc: collectionsOpen ? 'Referme la vue plein écran des collections.' : 'Ouvre immédiatement la vue plein écran des collections.',
      aliases: ['collections', 'plein ecran', 'ouvrir', 'fermer'],
      key: 'Shift+L',
      action: () => toggleFullscreen(),
    },
    {
      id: 'context-flemme',
      section: 'Contexte',
      name: isFlemme ? 'Quitter le mode Flemme' : 'Activer le mode Flemme',
      desc: isFlemme ? 'Revient au mode Cyber Tournetablisme à deux decks.' : 'Passe en lecture simplifiée automatique.',
      aliases: ['mode', 'flemme', 'autoplay'],
      key: 'F',
      action: () => { toggleFlemme(); updateStatusBar(); },
    },
    {
      id: `context-deck-${otherDeck}`,
      section: 'Contexte',
      name: `Passer sur Deck ${otherDeckLabel}`,
      desc: `Déplace le focus de contrôle vers le deck ${otherDeckLabel}.`,
      aliases: ['deck', 'focus', otherDeck, `deck ${otherDeck}`],
      key: otherDeck === 'a' ? 'Shift+A' : 'Shift+B',
      action: () => setActiveDeck(otherDeck),
    },
  ];
}

function _resolveCommandById(commandId) {
  return [..._getContextualCommands(), ...COMMANDS].find(cmd => cmd.id === commandId) || null;
}

function _getRecentCommands() {
  const stats = _loadCommandPaletteStats();
  return stats.recentIds
    .map(_resolveCommandById)
    .filter(Boolean)
    .map(cmd => ({ ...cmd, section: 'Récentes' }));
}

function _getFrequentCommands() {
  const stats = _loadCommandPaletteStats();
  return Object.entries(stats.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([commandId]) => _resolveCommandById(commandId))
    .filter(Boolean)
    .map(cmd => ({ ...cmd, section: 'Fréquentes' }));
}

function _dedupeCommands(commands) {
  const seen = new Set();
  return commands.filter(cmd => {
    if (!cmd?.id || seen.has(cmd.id)) return false;
    seen.add(cmd.id);
    return true;
  });
}

function _getPaletteCommands(filter = '') {
  if (filter) {
    return [..._getContextualCommands(), ...COMMANDS];
  }

  return _dedupeCommands([
    ..._getContextualCommands(),
    ..._getRecentCommands(),
    ..._getFrequentCommands(),
    ...COMMANDS,
  ]);
}

function _commandMatches(cmd, query) {
  if (!query) return true;
  const haystack = [cmd.name, cmd.desc, cmd.key, ...(cmd.aliases || [])]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function _renderCommandPalette(filter = '') {
  const list = document.getElementById('command-palette-list');
  list.innerHTML = '';
  const q = filter.toLowerCase();
  let visibleIdx = 0;
  let lastSection = null;
  const paletteCommands = _getPaletteCommands(q);
  paletteCommands.forEach((cmd) => {
    const match = _commandMatches(cmd, q);
    if (!match) return;
    if (cmd.section !== lastSection) {
      const heading = document.createElement('li');
      heading.className = 'section';
      heading.textContent = cmd.section;
      list.appendChild(heading);
      lastSection = cmd.section;
    }
    const li = document.createElement('li');
    li.className = 'cmd-item';
    li.dataset.idx = cmd.id;
    if (visibleIdx === 0) { li.classList.add('selected'); _cmdSelectedIdx = cmd.id; }
    visibleIdx++;
    li.innerHTML = `<span class="cmd-meta"><span class="cmd-name">${cmd.name}</span><span class="cmd-desc">${cmd.desc}</span></span><span class="cmd-key">${cmd.key}</span>`;
    li.addEventListener('click', () => _executeCommand(cmd.id));
    list.appendChild(li);
  });
  if (visibleIdx === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.innerHTML = `<span class="cmd-name">Aucune commande trouvée</span><span class="cmd-desc">Essaie aide, deck, collections, flemme ou crossfader.</span>`;
    list.appendChild(li);
  }
}

function _navigateCommandPalette(delta) {
  const list = document.getElementById('command-palette-list');
  const items = Array.from(list.querySelectorAll('li.cmd-item:not(.hidden)'));
  if (items.length === 0) return;
  let curIdx = items.findIndex(li => li.classList.contains('selected'));
  if (curIdx < 0) curIdx = 0;
  items[curIdx]?.classList.remove('selected');
  curIdx = (curIdx + delta + items.length) % items.length;
  items[curIdx]?.classList.add('selected');
  items[curIdx]?.scrollIntoView({ block: 'nearest' });
  _cmdSelectedIdx = items[curIdx].dataset.idx;
}

function _executeCommand(commandId) {
  const cmd = _resolveCommandById(commandId);
  const palette = document.getElementById('command-palette');
  if (commandId === 'help') {
    palette?.close();
    document.getElementById('shortcuts-help')?.showModal();
  } else if (cmd) {
    cmd.action();
    palette?.close();
  }
  _recordCommandUsage(commandId);
}

function _openCommandPalette() {
  const dlg = document.getElementById('command-palette');
  const input = document.getElementById('command-palette-input');
  if (!dlg || !input) return;
  if (dlg.open) {
    input.focus();
    return;
  }
  _dismissCommandPaletteHint();
  input.value = '';
  _renderCommandPalette('');
  try {
    dlg.showModal();
  } catch {
    return;
  }
  input.focus();
}

function _dismissCommandPaletteHint() {
  const hint = document.getElementById('command-palette-hint');
  if (!hint) return;
  hint.classList.remove('show');
  try { sessionStorage.setItem('cmdPaletteHintSeen', '1'); } catch {}
}

function _showCommandPaletteHint() {
  let seen = false;
  try { seen = sessionStorage.getItem('cmdPaletteHintSeen') === '1'; } catch {}
  if (seen) return;
  const hint = document.getElementById('command-palette-hint');
  if (!hint) return;
  hint.classList.add('show');
  setTimeout(() => _dismissCommandPaletteHint(), 4500);
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
  if (b) { loadTrack(b.dataset.load, parseInt(b.dataset.idx)); updateStatusBar(); e.stopPropagation(); return; }
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
  if (b) { loadTrack(b.dataset.load, parseInt(b.dataset.idx)); updateStatusBar(); e.stopPropagation(); return; }
  // Flemme playlist: click row to load + play on deck A
  if (flemmeMode) {
    const row = e.target.closest('tr[data-pos]');
    if (row && !e.target.closest('td[data-contrib]')) {
      const pos = parseInt(row.dataset.pos);
      const idx = parseInt(row.dataset.idx);
      setFlemmeIndex(pos);
      loadTrack('a', idx);
      updateStatusBar();
      updateFlemmeHighlight(pos);
      setTimeout(() => { if (deckA.audio && deckA.audio.paused) togglePlay('a'); }, 100);
    }
  }
});

document.getElementById('library-body').addEventListener('dblclick', e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const idx = parseInt(tr.dataset.idx);
  if (!deckA.track) loadTrack('a', idx);
  else if (!deckB.track) loadTrack('b', idx);
  else loadTrack('a', idx);
  updateStatusBar();
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
      updateStatusBar();
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
  // Cmd+K / Ctrl+K — open command palette
  if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    _openCommandPalette();
    return;
  }

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

  // Flemme mode navigation
  if (flemmeMode) {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault(); navigateFlemme(1); return;
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault(); navigateFlemme(-1); return;
    } else if (e.key === 'Enter') {
      e.preventDefault(); loadFlemmeHighlighted(); return;
    }
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

  // Shift+A/B — sélectionner deck actif · Shift+L — toggle collections
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
  } else if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    toggleFlemme();
    updateStatusBar();
  }
});

// Shortcuts help dialog handlers
document.getElementById('shortcuts-close')?.addEventListener('click', () =>
  document.getElementById('shortcuts-help').close());
document.getElementById('shortcuts-help')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

// Command palette handlers
document.getElementById('command-palette-input')?.addEventListener('input', e =>
  _renderCommandPalette(e.target.value));
document.getElementById('command-palette-input')?.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); _navigateCommandPalette(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _navigateCommandPalette(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); _executeCommand(_cmdSelectedIdx); }
  else if (e.key === 'Escape') { document.getElementById('command-palette').close(); }
});
document.getElementById('command-palette')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
document.getElementById('command-palette-open')?.addEventListener('click', () => {
  _openCommandPalette();
});
_showCommandPaletteHint();

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
  updateStatusBar();
})();
