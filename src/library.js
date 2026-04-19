import { fixBadEscapes, mapPost } from './lib.js';

export const API_BASE = 'https://www.musiqueapproximative.net';
export const LIBRARY_PAGE = 100;
export let LIBRARY = [];

export async function fetchLibrary() {
  try {
    const res = await fetch(API_BASE + '/posts?format=json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const fixed = fixBadEscapes(raw);
    const data = JSON.parse(fixed);
    const posts = Array.isArray(data) ? data : (data.posts || []);
    LIBRARY = posts.map(mapPost);
  } catch (err) {
    console.error('Library fetch failed:', err);
    LIBRARY = [];
  }
}

export function renderLibrary(filter = "", contribFilter = "") {
  const tbody = document.getElementById('library-body');
  tbody.innerHTML = "";
  const f = filter.trim().toLowerCase();
  const matches = [];
  LIBRARY.forEach((t, i) => {
    const s = (t.artist + " " + t.title + " " + t.contrib + " " + t.mood).toLowerCase();
    if (f && !s.includes(f)) return;
    if (contribFilter && t.contrib !== contribFilter) return;
    matches.push({ t, i });
  });
  const visible = matches.slice(0, LIBRARY_PAGE);
  visible.forEach(({ t, i }) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    tr.innerHTML = `
      <td class="num">${String(i+1).padStart(2,'0')}</td>
      <td class="artist">${t.artist}</td>
      <td class="title">${t.title}${t.mood ? ` <span style="color:var(--ma-gray-dark);font-style:normal;">· ${t.mood}</span>` : ''}</td>
      <td class="num">${t.bpm ?? '—'}</td>
      <td>${t.key || '—'}</td>
      <td class="num">${t.dur ?? '—'}</td>
      <td class="contrib">${t.contrib}</td>
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
    renderLibrary(document.getElementById('library-search').value, sel.value);
  });
}
