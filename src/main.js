import { deckA, deckB } from './audio.js';
import { fetchLibrary, LIBRARY, renderLibrary, populateContribFilter } from './library.js';
import { applyCrossfader, adjustXfader, wireXfader, wireChannelFader, wireEq, wirePitch,
         loadTrack, togglePlay, sync, animate } from './mixer.js';
import { initMidi } from './midi.js';

wireXfader();
wireChannelFader('fader-a', deckA);
wireChannelFader('fader-b', deckB);
wireEq('a', deckA);
wireEq('b', deckB);
wirePitch('a', deckA);
wirePitch('b', deckB);
applyCrossfader();

document.getElementById('library-search').addEventListener('input', e =>
  renderLibrary(e.target.value, document.getElementById('contrib-filter').value));

document.getElementById('library-body').addEventListener('click', e => {
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



window.addEventListener('keydown', e => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === 'a' || e.key === 'A') togglePlay('a');
  else if (e.key === 'l' || e.key === 'L') togglePlay('b');
  else if (e.key === 'ArrowLeft') adjustXfader(-0.05);
  else if (e.key === 'ArrowRight') adjustXfader(0.05);

  else if (e.key === ' ') { e.preventDefault(); if (deckA.playing || deckB.playing) { if(deckA.playing) togglePlay('a'); if(deckB.playing) togglePlay('b'); } }
});

function applyTweaks(t) {
  document.body.classList.toggle('invert', !!t.invertRig);
  document.getElementById('library').classList.toggle('hidden', !t.showLibrary);
  document.getElementById('tw-invert').classList.toggle('on', !!t.invertRig);
  document.getElementById('tw-library').classList.toggle('on', !!t.showLibrary);
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
document.getElementById('tw-invert').addEventListener('click', () => setTweak('invertRig', !tweaks.invertRig));
document.getElementById('tw-library').addEventListener('click', () => setTweak('showLibrary', !tweaks.showLibrary));
document.getElementById('tw-session').addEventListener('input', e => setTweak('sessionName', e.target.value));

window.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === '__activate_edit_mode') document.getElementById('tweaks').classList.add('visible');
  else if (d.type === '__deactivate_edit_mode') document.getElementById('tweaks').classList.remove('visible');
});
try { window.parent.postMessage({type:'__edit_mode_available'}, '*'); } catch(e){}

requestAnimationFrame(animate);
initMidi();
(async () => {
  await fetchLibrary();
  renderLibrary();
  populateContribFilter();
  if (LIBRARY.length > 0) loadTrack('a', 0);
  if (LIBRARY.length > 1) loadTrack('b', 1);
})();
