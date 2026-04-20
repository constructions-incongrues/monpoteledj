import { fixBadEscapes, mapPost } from './lib.js';

export const API_BASE = 'https://www.musiqueapproximative.net';
export const LIBRARY_PAGE = 100;
export let LIBRARY = [];

// Mark state — persisted in sessionStorage
const MARKS_KEY = '__ma_marks__';
export let markFilter = 0; // 0 = all, -1 = all marked, 1-5 = specific color

// Search mode: 'all' | 'artist' | 'title' | 'contrib'
export let searchMode = 'all';

// Track current filter state so cycleMark/unmarkTrack can re-render correctly
let _searchFilter = '';
let _contribFilter = '';

export function setSearchMode(mode) {
  searchMode = mode;
  renderLibrary(_searchFilter, _contribFilter, markFilter);
}

export function saveMarks() {
  try {
    const data = {};
    LIBRARY.forEach((t, i) => { if (t.mark) data[i] = t.mark; });
    sessionStorage.setItem(MARKS_KEY, JSON.stringify(data));
  } catch (e) { /* sessionStorage unavailable */ }
}

export function loadMarks() {
  try {
    const raw = sessionStorage.getItem(MARKS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([idx, mark]) => {
      const i = parseInt(idx);
      if (LIBRARY[i]) LIBRARY[i].mark = mark;
    });
  } catch (e) { /* ignore */ }
}

export async function fetchLibrary() {
  try {
    const res = await fetch(API_BASE + '/posts?format=json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const fixed = fixBadEscapes(raw);
    const data = JSON.parse(fixed);
    const posts = Array.isArray(data) ? data : (data.posts || []);
    LIBRARY = posts.map(mapPost);
    loadMarks(); // restore marks from sessionStorage
  } catch (err) {
    console.error('Library fetch failed:', err);
    LIBRARY = [];
  }
}

export function cycleMark(trackIdx) {
  const t = LIBRARY[trackIdx];
  if (!t) return;
  t.mark = (t.mark || 0) >= 5 ? 0 : (t.mark || 0) + 1;
  saveMarks();
  renderLibrary(_searchFilter, _contribFilter, markFilter);
  renderPlaylists();
}

export function unmarkTrack(trackIdx) {
  const t = LIBRARY[trackIdx];
  if (!t) return;
  t.mark = 0;
  saveMarks();
  renderLibrary(_searchFilter, _contribFilter, markFilter);
  renderPlaylists();
}

export function renderLibrary(filter = "", contribFilter = "", markOnly = 0) {
  _searchFilter = filter;
  _contribFilter = contribFilter;
  markFilter = markOnly;
  const tbody = document.getElementById('library-body');
  tbody.innerHTML = "";
  const f = filter.trim().toLowerCase();
  const matches = [];
  LIBRARY.forEach((t, i) => {
    if (f) {
      let haystack;
      if (searchMode === 'artist') haystack = t.artist.toLowerCase();
      else if (searchMode === 'title') haystack = (t.title + ' ' + t.mood).toLowerCase();
      else if (searchMode === 'contrib') haystack = t.contrib.toLowerCase();
      else haystack = (t.artist + ' ' + t.title + ' ' + t.contrib + ' ' + t.mood).toLowerCase();
      if (!haystack.includes(f)) return;
    }
    if (contribFilter && t.contrib !== contribFilter) return;
    if (markOnly === -1 && !t.mark) return;
    else if (markOnly > 0 && t.mark !== markOnly) return;
    matches.push({ t, i });
  });
  const visible = matches.slice(0, LIBRARY_PAGE);
  visible.forEach(({ t, i }) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    if (t.mark) tr.classList.add('mark-' + t.mark);
    const pip = t.mark
      ? `<span class="mark-pip">${t.mark}</span>`
      : '';
    tr.innerHTML = `
      <td class="mark-cell">${pip}</td>
      <td class="artist">${t.artist}</td>
      <td class="title">${t.title}${t.mood ? ` <span style="color:var(--ma-gray-dark);font-style:normal;">· ${t.mood}</span>` : ''}</td>
      <td class="num">${t.bpm ?? '—'}</td>
      <td>${t.key || '—'}</td>
      <td class="num">${t.dur ?? '—'}</td>
      <td class="contrib" data-contrib="${t.contrib}">${t.contrib}</td>
      <td class="loadcell">
        <button class="load-btn" data-load="a" data-idx="${i}"><span>→ A</span></button>
        <button class="load-btn" data-load="b" data-idx="${i}"><span>→ B</span></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  const hidden = matches.length - visible.length;
  const label = hidden > 0
    ? `${matches.length} morceaux — ${hidden} non affichés, utilisez la recherche`
    : `${matches.length} morceaux dans le carton`;
  document.getElementById('lib-count').textContent = label;

  // Dim filter buttons for mark colors that have no tracks
  const counts = [0, 0, 0, 0, 0, 0];
  LIBRARY.forEach(t => { if (t.mark >= 1 && t.mark <= 5) counts[t.mark]++; });
  for (let c = 1; c <= 5; c++) {
    const btn = document.querySelector(`.mark-filter-btn[data-marks="${c}"]`);
    if (btn) btn.classList.toggle('mark-empty', counts[c] === 0);
  }
}

export function renderPlaylists() {
  const container = document.getElementById('playlists');
  if (!container) return;
  container.innerHTML = '';
  for (let c = 1; c <= 5; c++) {
    const tracks = LIBRARY.map((t, i) => ({ t, i })).filter(({ t }) => t.mark === c);
    if (tracks.length === 0) continue;
    const section = document.createElement('div');
    section.className = 'playlist';
    section.innerHTML = `
      <div class="playlist-head">
        <span class="mark-pip">${c}</span>
        <span class="playlist-count">${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}</span>
      </div>
      <table class="playlist-table"><tbody>${tracks.map(({ t, i }) => `
        <tr data-idx="${i}">
          <td class="artist">${t.artist}</td>
          <td class="title">${t.title}</td>
          <td class="num">${t.dur ?? '—'}</td>
          <td class="num">${t.bpm ?? '—'}</td>
          <td>${t.key || '—'}</td>
          <td class="loadcell">
            <button class="load-btn" data-load="a" data-idx="${i}"><span>→ A</span></button>
            <button class="load-btn" data-load="b" data-idx="${i}"><span>→ B</span></button>
          </td>
        </tr>`).join('')}</tbody></table>`;
    container.appendChild(section);
  }
}

export function populateContribFilter() {
  const sel = document.getElementById('contrib-filter');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  const contribs = [...new Set(LIBRARY.map(t => t.contrib).filter(Boolean))].sort();
  contribs.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => {
    renderLibrary(document.getElementById('library-search').value, sel.value, markFilter);
  });
}
