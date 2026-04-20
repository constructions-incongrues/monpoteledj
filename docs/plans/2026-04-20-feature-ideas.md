# Idées de Features - Session 20 avril 2026

Liste des features proposées pour le DJ mixer. À creuser une par une.

## Features

### 1. Favoris / Bookmarks de la librairie ✅
- Marquer/unmarquer des fichiers de la librairie pour les retrouver facilement
- Afficher les favoris dans un onglet dédié pendant la session
- Permet un accès rapide aux tracks sans scroller la liste complète
- **Contexte**: Utile quand on crée une mix, pour isoler les tracks à utiliser

**Raccourcis clavier:**
- `s` : marquer une track
- `S` (Shift+s) : démarquer une track
- Appuyer rapidement sur `s` plusieurs fois = cycle entre 5 couleurs de marques
- Chaque couleur correspond à une playlist différente (5 playlists max)

### 2. Palette de commande (Command Palette)
- Interface de recherche rapide comme dans VS Code
- Accès à toutes les commandes principales de l'app (play, pause, search, etc.)
- **Raccourci**: Cmd+K (ou Ctrl+K sur Windows/Linux)
- Permet une navigation sans souris

### 3. Fullscreen Library Search ✅
- Affiche la librairie en fullscreen pour une recherche rapide
- **Raccourci**: Shift+B (toggle), ↑/↓ ou j/k pour naviguer, Enter pour charger, Escape pour fermer

### 4. Dub Sirens
- Effets de sirène dub classiques (oscillateur + modulation)
- Assignables à un deck ou au master

### 5. Mode F(lemme) — 1 deck + autoplay
- Un seul deck visible
- Playlist en lecture automatique (enchaîne les tracks marquées)
- Idéal pour DJ sets passifs / soirées sans intervention

### 6. Enqueue in situ — à la Clementine
- File d'attente visible dans la bibliothèque (indique l'ordre de passage)
- Drag-and-drop ou raccourci clavier pour ajouter une track à la queue
- Le deck suivant charge automatiquement la prochaine en queue

### 7. Export de session
- Enregistrement de la session (quels formats ? WAV, MP3, OGG ?)
- Export de la setlist (tracklist avec timestamps)
- Partage de la mix ou de la liste de lecture

### 8. Communication aux contributeurs
- Notifier les contributeurs quand leur track est jouée ?
- Intégration avec le système de contribution de musiqueapproximative.net

### 9. Lien vers le GitHub
- Lien dans le footer ou le masthead vers le repo
- Encourage les contributions et la transparence

### 10. Refaire le README
- Documenter l'architecture, les dépendances, comment lancer en local
- Ajouter des screenshots / captures d'écran

### 11. Communication mi
- À préciser

### utiliser des composants react existants
- Évaluer si pertinent pour certains composants UI

---

## Bugs à corriger

### BUG: Calcul du BPM ne fonctionne pas ✅ (résolu — Worker)
- Résolu en déplaçant le calcul dans un Web Worker
- Le decode se fait sur le main thread (AudioContext), le calcul BPM/clef dans le worker

---

## Status

### Features
- [x] Favoris / Bookmarks de la librairie
- [x] Fullscreen Library Search
- [x] Palette de commande
- [ ] Dub Sirens
- [ ] Mode F(lemme)
- [ ] Enqueue in situ (à la Clementine)
- [ ] Export de session
- [ ] Communication aux contributeurs
- [ ] Lien GitHub
- [ ] Refaire le README
- [ ] Communication mi

### Bugs
- [x] BUG: Calcul du BPM ne fonctionne pas (résolu)
