# Publikacja na GitHub Pages

Strona jest w 100% statyczna (HTML + CSS + JS, bez budowania i bez serwera),
więc GitHub Pages poda ją tak, jak leży w folderze.

## Kroki

1. Załóż repozytorium na GitHubie (np. `HappyBday`) i wrzuć do niego
   **zawartość** tego folderu, tak żeby `index.html` leżał w głównym katalogu:
   ```
   git init
   git add .
   git commit -m "HappyBday"
   git branch -M main
   git remote add origin https://github.com/<login>/<repo>.git
   git push -u origin main
   ```
2. Na GitHubie: **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main**, folder: **/ (root)** → **Save**
3. Po minucie-dwóch strona będzie pod adresem
   `https://<login>.github.io/<repo>/` (wejście: `index.html`).

## Ważne

- Wszystkie ścieżki są względne (`assets/...`, `re/...`, `vendor/...`),
  więc strona działa pod `/<repo>/`, z dysku i na dowolnym hostingu.
- GitHub Pages rozróżnia wielkość liter: `Leon.png` to inny plik niż `leon.png`.
  Zmieniając nazwy plików, popraw też odwołania w kodzie.
- Plik `.nojekyll` wyłącza Jekylla (GitHub nie pomija wtedy żadnych plików).
- Nic nie jest ładowane z CDN: three.js leży w `vendor/`, czcionka
  Press Start 2P w `assets/fonts/`. Jedyny wyjątek to kotki w Snake'u
  (cataas.com przez https) - bez internetu gra pokazuje zapasowy obrazek.
- Resident Cake (`re.html`) potrzebuje WebGL - działa w każdej nowej
  przeglądarce na komputerze; na telefonie pokaże komunikat "tylko PC".
- Leaderboard (ikona High Scores) to zwykły plik `leaderboard.js` - po
  zmianie wyników wystarczy go wrzucić na nowo (commit + push).
- `.gitignore` pomija śmieci systemowe i edytorów (`.DS_Store`, `*.bak`, `*.swp`...).
