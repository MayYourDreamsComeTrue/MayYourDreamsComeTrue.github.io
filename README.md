# May Your Birthday Wishes Come True! 🎂

**PL:** Mała strona-prezent urodzinowy w stylu starego Windowsa 95 (pixel art).
Na pulpicie są minigry (Less Pull Together, Primo-Man, Sigil Snake, Slime Invaders,
Citlali Run, Resident Cake 3D, pasjans), Paint, odtwarzacz muzyki i tabela wyników
(High Scores - wyniki edytuje się w `leaderboard.js`).

**EN:** A tiny birthday-gift website styled like an old Windows 95 desktop (pixel art).
It has minigames (Less Pull Together, Primo-Man, Sigil Snake, Slime Invaders,
Citlali Run, Resident Cake 3D, Solitaire), Paint, a music player and a High Scores
leaderboard (scores live in `leaderboard.js`).

🔗 **Live:** https://<login>.github.io/HappyBday/ *(placeholder - replace after publishing)*

## Uruchomienie lokalne / Run locally

Strona jest w 100% statyczna - bez budowania. / Fully static - no build step.

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. (Opening `index.html` directly from disk works too.)
Best on a PC, window at least 1024×640; Resident Cake needs WebGL.

## Publikacja / Deploy

Patrz / see [DEPLOY.md](DEPLOY.md) (GitHub Pages).

## Licencje / Licenses

- Font Press Start 2P - SIL OFL (`assets/fonts/OFL.txt`)
- three.js - MIT (`vendor/three.LICENSE.txt`)
