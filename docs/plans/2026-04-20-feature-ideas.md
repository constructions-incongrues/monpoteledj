# Idées de Features - Session 20 avril 2026

Roadmap produit du DJ mixer, alignée avec les livraisons réelles sur `main`.

## Features

### 1. Favoris / Bookmarks des collections ✅
- Marquer/unmarquer des fichiers des collections pour les retrouver facilement
- Afficher les favoris dans un onglet dédié pendant la session
- Permet un accès rapide aux tracks sans scroller la liste complète

### 2. Palette de commande (Command Palette) ✅
- Interface de recherche rapide comme dans VS Code
- Accès à toutes les commandes principales de l'app (play, pause, search, etc.)
- Raccourci: Cmd+K (ou Ctrl+K sur Windows/Linux)

### 3. Fullscreen Collections Search ✅
- Affiche les collections en fullscreen pour une recherche rapide
- **Raccourci**: Shift+L (toggle), ↑/↓ ou j/k pour naviguer, Enter pour charger, Escape pour fermer

### 4. Dub Sirens
- Effets de sirene dub classiques (oscillateur + modulation)
- Assignables à un deck ou au master

### 5. Mode F(lemme) - 1 deck + autoplay ✅
- Un seul deck visible
- Playlist en lecture automatique (enchaine les tracks marquees)
- Ideal pour DJ sets passifs / soirees sans intervention

### 6. Enqueue in situ — à la Clementine
- File d'attente visible dans les collections (indique l'ordre de passage)
- Drag-and-drop ou raccourci clavier pour ajouter une track à la queue
- Le deck suivant charge automatiquement la prochaine en queue

### 7. Export de session
- Enregistrement de la session (MVP a cadrer)
- Export de la setlist (tracklist avec timestamps)
- Partage de la mix ou de la liste de lecture

### 8. Communication aux contributeurs
- Notifier les contributeurs quand leur track est jouee
- Integration avec le systeme de contribution musiqueapproximative.net

### 9. Lien vers le GitHub
- Lien dans le footer ou le masthead vers le repo
- Encourage les contributions et la transparence

### 10. Refaire le README
- Documenter l'architecture, les dependances, comment lancer en local
- Ajouter des captures d'ecran

### 11. Communication mi
- A preciser

### 12. Evaluer l'usage de composants React existants
- Evaluer si pertinent pour certains composants UI

## Bugs a corriger

### BUG: Calcul du BPM ne fonctionne pas ✅ (resolu - Worker)
- Resolu en deplacant le calcul dans un Web Worker
- Le decode se fait sur le main thread (AudioContext), le calcul BPM/clef dans le worker

## Status global

## Status

### Features
- [x] Favoris / Bookmarks des collections
- [x] Fullscreen Collections Search
- [x] Palette de commande
- [ ] Dub Sirens
- [ ] Enqueue in situ
- [ ] Export de session
- [ ] Communication aux contributeurs
- [ ] Lien GitHub
- [ ] Refaire le README
- [ ] Communication mi
- [ ] Evaluation React

## Priorisation

### Now (MVP)
- #12 - Aligner la roadmap avec les livraisons réelles
- #13 - Ajouter un lien GitHub visible dans l'interface
- #14 - Refaire le README développeur et utilisateur

### Next
- #16 - Enqueue in situ dans la librairie
- #17 - Dub Sirens assignables deck/master
- #15 - Communication aux contributeurs lors de la lecture d'une track

### Later
- #18 - EPIC Export de session (audio + setlist)
- #19 - UX d'export session
- #20 - Export audio WAV (MVP)
- #21 - Export setlist horodatée
- #22 - Discovery: évaluer l'usage de composants React
- #23 - Discovery: cadrer l'item "Communication mi"

## Gouvernance backlog

- #24 - Mettre en place les labels roadmap (component/size/phase/priority)
