# Core & Nek/Trapezium Routine Coach (Webapp)

Statische webapp voor wielrenners met ACDF C5-C6-voorzichtige routineplanning, checklist en weekprogressie.

## Lokaal draaien

```bash
python3 -m http.server 8080
```

Open daarna `http://localhost:8080`.

## Publiceren via GitHub Pages

Deze repo bevat al een workflow (`.github/workflows/deploy-pages.yml`) die automatisch publiceert naar GitHub Pages.

1. Maak een nieuwe repository op GitHub.
2. Koppel je lokale project aan die remote.
3. Push naar branch `main`.
4. Ga in GitHub naar `Settings > Pages` en kies `Build and deployment: GitHub Actions`.
5. Wacht tot de workflow klaar is in `Actions`.
6. Je site staat live op:
   - `https://<jouw-github-username>.github.io/<repo-naam>/`

## Bestanden

- `index.html`
- `styles.css`
- `app.js`
