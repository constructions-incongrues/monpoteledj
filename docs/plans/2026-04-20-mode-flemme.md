# Mode Flemme — Plan d'implémentation

> **Status:** Plan  
> **Date:** 20 avril 2026  
> **Goal:** Un mode DJ passif avec un seul deck + autoplay des tracks marquées

---

## Concept

Le **Mode Flemme** (ou "Mode F") transforme le mixer en lecteur automatique :
- Un seul deck visible (interface simplifiée)
- Lecture automatique de la playlist (tracks marquées ou toute la librairie)
- Crossfade automatique entre morceaux
- Idéal pour soirées sans intervention ou écoute en fond

---

## Architecture

### Fichiers à modifier/créer

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `src/flemme.js` | Create | State machine du mode flemme, autoplay logic |
| `src/mixer.js` | Modify | Export `crossfadeTo(deckId, duration)` pour transition douce |
| `src/main.js` | Modify | Raccourci `F` pour toggle mode flemme |
| `index.html` | Modify | CSS pour masquer deck B, ajouter indicateur "Mode F" |

---

## Task 1: CSS pour mode flemme

**Files:** `index.html`

- [ ] **Step 1: Ajouter classe `.flemme-mode` sur body**

Quand le mode flemme est actif, `body` a la classe `flemme-mode`.

- [ ] **Step 2: CSS pour masquer deck B et simplifier l'UI**

```css
.flemme-mode .deck[data-side="b"] { display: none; }
.flemme-mode .xfader-wrap { display: none; }
.flemme-mode .deck[data-side="a"] { 
  width: 100%; 
  max-width: 600px; 
  margin: 0 auto; 
}
.flemme-mode .booth {
  display: flex;
  justify-content: center;
}
```

- [ ] **Step 3: Badge "Mode F" dans le masthead**

```html
<span id="flemme-badge" style="display:none; ...">MODE F</span>
```

---

## Task 2: Logic d'autoplay dans flemme.js

**Files:** Create `src/flemme.js`

- [ ] **Step 1: State et exports**

```js
export let flemmeMode = false;
export let flemmePlaylist = []; // indices des tracks à jouer
export let flemmeIndex = 0;
let _crossfadeTimer = null;
```

- [ ] **Step 2: Fonction `enableFlemme()`**

```js
export function enableFlemme() {
  flemmeMode = true;
  document.body.classList.add('flemme-mode');
  document.getElementById('flemme-badge').style.display = 'block';
  
  // Construire playlist: tracks marquées ou toute la librairie
  flemmePlaylist = LIBRARY
    .map((t, i) => ({ track: t, idx: i }))
    .filter(({ track }) => track.marks > 0 || markFilter === 0)
    .map(({ idx }) => idx);
  
  if (flemmePlaylist.length === 0) {
    flemmePlaylist = LIBRARY.map((_, i) => i);
  }
  
  flemmeIndex = 0;
  loadTrack('a', flemmePlaylist[0]);
  togglePlay('a');
  _scheduleNext();
}
```

- [ ] **Step 3: Fonction `disableFlemme()`**

```js
export function disableFlemme() {
  flemmeMode = false;
  clearTimeout(_crossfadeTimer);
  document.body.classList.remove('flemme-mode');
  document.getElementById('flemme-badge').style.display = 'none';
}
```

- [ ] **Step 4: Fonction `_scheduleNext()` — autoplay**

```js
function _scheduleNext() {
  if (!flemmeMode) return;
  const deck = deckA;
  if (!deck.audio || !deck.track) return;
  
  const remaining = deck.audio.duration - deck.audio.currentTime;
  const crossfadeTime = 8; // 8 secondes avant la fin
  
  if (remaining > crossfadeTime) {
    _crossfadeTimer = setTimeout(_scheduleNext, (remaining - crossfadeTime) * 1000);
  } else {
    _startCrossfade();
  }
}

function _startCrossfade() {
  flemmeIndex = (flemmeIndex + 1) % flemmePlaylist.length;
  // En mode flemme, on utilise un seul deck, donc on load le suivant
  // et on fait un fondu sortant sur le précédent
  const nextIdx = flemmePlaylist[flemmeIndex];
  
  // Fade out actuel
  const gain = deckA.gain.gain;
  gain.setTargetAtTime(0, ac.currentTime, 3);
  
  setTimeout(() => {
    loadTrack('a', nextIdx);
    gain.setTargetAtTime(1, ac.currentTime, 0.5);
    togglePlay('a');
    _scheduleNext();
  }, 4000);
}
```

---

## Task 3: Toggle mode flemme dans main.js

**Files:** `src/main.js`

- [ ] **Step 1: Import flemme module**

```js
import { flemmeMode, enableFlemme, disableFlemme } from './flemme.js';
```

- [ ] **Step 2: Raccourci `F` pour toggle**

Dans le listener keydown, ajouter :

```js
if (e.key === 'f' && !e.shiftKey && e.target.tagName !== 'INPUT') {
  e.preventDefault();
  if (flemmeMode) disableFlemme();
  else enableFlemme();
  return;
}
```

---

## Task 4: Écouter la fin du morceau

**Files:** `src/mixer.js` ou `src/flemme.js`

- [ ] **Step 1: Listener 'ended' sur audio**

Dans `attachAudio` ou dans flemme.js, écouter l'event 'ended' pour déclencher le morceau suivant en mode flemme.

```js
deck.audio.addEventListener('ended', () => {
  if (flemmeMode) _playNext();
});
```

---

## Task 5: Tests manuels

- [ ] Appuyer sur `F` → Mode flemme activé, deck B disparaît
- [ ] La musique joue automatiquement
- [ ] À la fin du morceau, le suivant commence avec fondu
- [ ] Re-appuyer sur `F` → Mode normal, deck B réapparaît
- [ ] Badge "MODE F" visible/invisible selon état

---

## Extensions futures (hors scope)

- [ ] Option pour crossfade plus court/long (via UI)
- [ ] Shuffle de la playlist
- [ ] Skip manuel avec raccourci (déjà `V`?)
- [ ] Visualisation de la file d'attente

---

## Commit strategy

```bash
git add src/flemme.js
git commit -m "feat(flemme): create autoplay module"

git add index.html
git commit -m "feat(flemme): add CSS for single-deck mode"

git add src/main.js
git commit -m "feat(flemme): wire F key toggle"
```
