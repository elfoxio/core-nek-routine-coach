# Core & Nek/Trapezium Routine Coach (Webapp)

Statische webapp voor wielrenners met ACDF C5-C6-voorzichtige routineplanning, checklist en weekprogressie.

## Lokaal draaien

```bash
python3 -m http.server 8080
```

Open daarna `http://localhost:8080`.

## Oefeningen aanpassen (zonder code)

Alle routine-inhoud staat in:

- `data/routine.json`

Per dag gebruik je dit formaat:

```json
{
  "maandag": {
    "duration": "12-16 min",
    "exercises": [
      {
        "id": "unieke-id",
        "name": "Naam oefening",
        "focus": "Core",
        "note": "Sets/reps + cue",
        "target": true
      }
    ]
  }
}
```

Regels:

- `id` moet uniek blijven, anders telt progressie fout.
- `target: true` telt mee in de weekprogressie.
- `target: false` blijft zichtbaar maar telt niet mee (optioneel/herstel).

Na aanpassen van `data/routine.json`: commit + push naar `main`; GitHub Pages deployt automatisch.

## Health data dashboard (JSON upload + advies)

Open:

- `health-dashboard.html`

Wat je kan doen:

- Upload je `HealthAutoExport...json`
- Dashboard berekent automatisch trends (stappen, slaap, HR, HRV, gewicht)
- Je krijgt concrete verbeteradviezen voor training, herstel en leefstijl
- Laatste upload wordt lokaal bewaard in je browser (knop: `Laad laatste upload`)

Voor grote exports (bijv. >200 MB), maak eerst een compact bestand:

```bash
python3 health-analysis/export_dashboard_payload.py "/volledig/pad/naar/HealthAutoExport.json"
```

Upload daarna:

- `health-analysis/dashboard-payload.json`

## Recovery & Ride Coach (Garmin screenshot + dagelijkse status)

Open:

- `recovery-ride.html`

MVP bevat:

- Login
- Dagelijkse check-in (pijn/stress/energie/motivatie + metrics)
- Dashboard met status (groen/oranje/rood), trends en herstelkalender
- Coachadvies pagina met workout generator
- Workout export met keuze: Garmin workout (.json) of Zwift (.zwo)
- Dagelijkse check-in kan automatisch aangevuld worden vanuit Intervals sync
- Intervals CSV upload met post-workout analyse, tips en hersteladvies
- Auto Sync optie (backend): Intervals API -> Supabase -> Coaching AI (met geplande sync)
- Export naar CSV en print/PDF

Belangrijk:

- OCR gebeurt in de browser met Tesseract.js, dus kwaliteit hangt af van screenshot-scherpte en taal.
- Controleer altijd de ingevulde waarden voor je opslaat.
- Voor echte automatische Intervals-sync gebruik je de backend in `coaching-ai-sync-backend/`.

## Coaching AI backend (Option 2: automatische Intervals sync)

Backend map:

- `coaching-ai-sync-backend/`

Bevat:

- Cloudflare Worker (`worker.js`) met endpoints voor `latest` en `sync`
- Uurlijkse cron-sync
- Supabase SQL setup (`supabase.sql`)
- Setup stappen (`coaching-ai-sync-backend/README.md`)

## Publiceren via GitHub Pages

Deze repo bevat al een workflow (`.github/workflows/deploy-pages.yml`) die automatisch publiceert naar GitHub Pages.

1. Push naar branch `main`.
2. Ga in GitHub naar `Settings > Pages` en kies `Build and deployment: GitHub Actions`.
3. Wacht tot de workflow klaar is in `Actions`.

Je site staat live op:

- `https://<jouw-github-username>.github.io/<repo-naam>/`

## Bestanden

- `index.html`
- `styles.css`
- `app.js`
- `data/routine.json`
