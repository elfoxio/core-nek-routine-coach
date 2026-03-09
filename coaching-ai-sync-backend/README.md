# Coaching AI Sync Backend (Option 2)

Cloudflare Worker backend voor automatische Intervals sync + opslag in Supabase.

## Wat dit doet

- Scheduled sync elk uur (`cron` in `wrangler.toml`)
- Endpoint voor manuele sync (`POST /api/client/sync`)
- Endpoint voor historische backfill (`POST /api/client/backfill?days=365`)
- Endpoint om laatste workout op te halen (`GET /api/public/latest`)
- Schrijft laatste workout per athlete naar Supabase tabel `intervals_latest_workouts`
- Schrijft historische workouts naar `intervals_workouts_history`

## 1. Supabase tabel aanmaken

Voer [supabase.sql](./supabase.sql) uit in je Supabase SQL editor.

## 2. Worker secrets zetten

```bash
cd coaching-ai-sync-backend
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put INTERVALS_API_KEY
wrangler secret put CLIENT_SYNC_TOKEN
wrangler secret put ADMIN_SYNC_KEY
```

## 3. Variabelen configureren

In `wrangler.toml`:

- `DEFAULT_ATHLETE_ID`
- `INTERVALS_API_URL` (endpoint dat je laatste Intervals activiteit teruggeeft)
- optioneel `INTERVALS_AUTH_HEADER` en `INTERVALS_AUTH_PREFIX`

## 4. Deploy

```bash
wrangler deploy
```

## 5. Frontend koppelen

In `recovery-ride.html` > "Auto Sync via backend (optie 2)":

- Backend URL: je worker URL (bijv. `https://coaching-ai-sync.<subdomain>.workers.dev`)
- Client token: dezelfde waarde als `CLIENT_SYNC_TOKEN`
- Athlete ID: bv. `kevin`

Klik daarna `Bewaar sync instellingen` en `Sync nu`.

## API quick reference

- `GET /api/public/latest?athlete=<id>`
  - header: `x-client-token: <CLIENT_SYNC_TOKEN>`
- `POST /api/client/sync?athlete=<id>`
  - header: `x-client-token: <CLIENT_SYNC_TOKEN>`
- `POST /api/client/backfill?athlete=<id>&days=365`
  - header: `x-client-token: <CLIENT_SYNC_TOKEN>`
- `POST /api/admin/sync?athlete=<id>`
  - header: `x-admin-key: <ADMIN_SYNC_KEY>`

## Opmerkingen

- De worker verwacht dat `INTERVALS_API_URL` direct een JSON payload of array met activiteitdata terugstuurt.
- Als jouw Intervals endpoint andere veldnamen gebruikt, pas `mapIntervalsWorkout()` in `worker.js` aan.
