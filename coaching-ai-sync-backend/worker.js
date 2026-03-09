export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/public/latest" && request.method === "GET") {
        requireClientToken(request, env);
        const athlete = getAthleteId(url, env);
        const latest = await getLatestWorkout(env, athlete);
        return cors(jsonResponse(latest || { workout: null, syncedAt: null }));
      }

      if (path === "/api/public/history" && request.method === "GET") {
        requireClientToken(request, env);
        const athlete = getAthleteId(url, env);
        const days = getBackfillDays(url);
        const history = await getWorkoutHistory(env, athlete, days);
        return cors(jsonResponse({ workouts: history, days }));
      }

      if (path === "/api/client/sync" && request.method === "POST") {
        requireClientToken(request, env);
        const athlete = getAthleteId(url, env);
        const result = await runSync(env, athlete);
        return cors(jsonResponse(result));
      }

      if (path === "/api/client/backfill" && request.method === "POST") {
        requireClientToken(request, env);
        const athlete = getAthleteId(url, env);
        const days = getBackfillDays(url);
        const result = await runBackfill(env, athlete, days);
        return cors(jsonResponse(result));
      }

      if (path === "/api/admin/sync" && request.method === "POST") {
        requireAdminToken(request, env);
        const athlete = getAthleteId(url, env);
        const result = await runSync(env, athlete);
        return cors(jsonResponse(result));
      }

      return cors(jsonResponse({ error: "Not found" }, 404));
    } catch (err) {
      return cors(jsonResponse({ error: err.message || "unexpected_error" }, err.status || 500));
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runSync(env, env.DEFAULT_ATHLETE_ID || "default"));
  },
};

async function runSync(env, athleteId) {
  const raw = await fetchIntervalsLatest(env);
  const workout = mapIntervalsWorkout(raw);
  if (!workout) {
    throw httpError(404, "No workout data found in Intervals response");
  }

  const payload = {
    athlete_id: athleteId,
    synced_at: new Date().toISOString(),
    source_file: "intervals-api",
    workout,
  };

  await upsertLatestWorkout(env, payload);

  return {
    ok: true,
    syncedAt: payload.synced_at,
    sourceFile: payload.source_file,
    workout,
  };
}

async function runBackfill(env, athleteId, days) {
  const rawItems = await fetchIntervalsRange(env, days);
  if (!Array.isArray(rawItems) || !rawItems.length) {
    throw httpError(404, "No historical workouts found in Intervals response");
  }

  const workouts = rawItems
    .map((raw) => mapIntervalsWorkout(raw))
    .filter((w) => w && w.workout_id);

  if (!workouts.length) {
    throw httpError(404, "Historical payload had no mappable workouts");
  }

  await upsertWorkoutHistory(
    env,
    workouts.map((w) => ({
      athlete_id: athleteId,
      workout_id: w.workout_id,
      workout_date: w.start_date || new Date().toISOString(),
      source_file: "intervals-api-backfill",
      workout: w,
      synced_at: new Date().toISOString(),
    }))
  );

  const latest = workouts
    .slice()
    .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))[0];
  if (latest) {
    await upsertLatestWorkout(env, {
      athlete_id: athleteId,
      synced_at: new Date().toISOString(),
      source_file: "intervals-api-backfill",
      workout: latest,
    });
  }

  return {
    ok: true,
    importedCount: workouts.length,
    days,
    latestWorkoutDate: latest?.start_date || null,
  };
}

async function fetchIntervalsLatest(env) {
  const items = await fetchIntervalsList(env, { limit: 1 });
  return items[0] || null;
}

async function fetchIntervalsRange(env, days) {
  const oldest = isoDateDaysAgo(days);
  const items = await fetchIntervalsList(env, { limit: 1000, oldest });
  return items;
}

async function fetchIntervalsList(env, opts = {}) {
  const endpoint = env.INTERVALS_API_URL;
  if (!endpoint) throw httpError(500, "INTERVALS_API_URL missing");

  const authHeader = env.INTERVALS_AUTH_HEADER || "Authorization";
  const authPrefix = env.INTERVALS_AUTH_PREFIX || "Bearer";
  const authMode = (env.INTERVALS_AUTH_MODE || "BASIC_API_KEY").toUpperCase();
  const apiKey = env.INTERVALS_API_KEY;
  if (!apiKey) throw httpError(500, "INTERVALS_API_KEY missing");

  const headers = {
    Accept: "application/json",
  };
  if (authMode === "BASIC_API_KEY") {
    headers[authHeader] = `Basic ${encodeBase64(`API_KEY:${apiKey}`)}`;
  } else if (authMode === "BEARER") {
    headers[authHeader] = `${authPrefix} ${apiKey}`;
  } else if (authMode === "APIKEY_INLINE") {
    headers[authHeader] = `ApiKey API_KEY:${apiKey}`;
  } else {
    throw httpError(500, `Unsupported INTERVALS_AUTH_MODE: ${authMode}`);
  }

  const url = withIntervalsQuery(endpoint, opts);
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const detail = await resp.text();
    throw httpError(502, `Intervals API error ${resp.status}: ${detail.slice(0, 300)}`);
  }

  const data = await resp.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.activities)) return data.activities;
  if (data?.activity) return [data.activity];
  if (data && typeof data === "object") return [data];
  return [];
}

function mapIntervalsWorkout(raw) {
  if (!raw || typeof raw !== "object") return null;

  const rawId = pick(raw, ["id", "activity_id", "activityId", "external_id"]);
  const name = pick(raw, ["name", "activity_name", "title", "workout"]);
  const startDate = pick(raw, ["start_date", "startDate", "date", "start_time", "start"]);
  const durationMin = toMinutes(pick(raw, ["duration_min", "duration", "moving_time", "elapsed_time", "time"]));
  const distanceKm = toKilometers(pick(raw, ["distance_km", "distance", "distanceKm"]));
  const elevationM = toNumber(pick(raw, ["elevation_m", "elevation", "ascent", "climb"]));
  const avgPower = toNumber(pick(raw, ["avg_power", "average_power", "power"]));
  const np = toNumber(pick(raw, ["np", "normalized_power", "norm_power"]));
  const avgHr = toNumber(pick(raw, ["avg_hr", "average_hr", "hr_avg", "heartrate_average"]));
  const maxHr = toNumber(pick(raw, ["max_hr", "hr_max", "heartrate_max"]));
  const tss = toNumber(pick(raw, ["tss", "icu_training_load", "training_stress", "load"]));
  const ifValue = toNumber(pick(raw, ["if_value", "if", "intensity_factor"]));
  const sleepHours = toHours(
    pick(raw, ["sleep_hours", "sleep", "sleep_duration_hours", "sleepDurationHours"]) ??
      pickNested(raw, [["wellness", "sleep_hours"], ["wellness", "sleep"], ["sleep", "hours"], ["metrics", "sleep_hours"]])
  );
  const hrvMs = toNumber(
    pick(raw, ["hrv_ms", "hrv", "hrv_avg", "heart_rate_variability"]) ??
      pickNested(raw, [["wellness", "hrv"], ["wellness", "hrv_ms"], ["metrics", "hrv_ms"]])
  );
  const rhrBpm = toNumber(
    pick(raw, ["rhr_bpm", "resting_hr", "resting_heart_rate", "restingHR"]) ??
      pickNested(raw, [["wellness", "resting_hr"], ["wellness", "rhr"], ["metrics", "resting_hr"]])
  );
  const weightKg = toNumber(
    pick(raw, ["weight_kg", "weight", "body_weight", "mass"]) ??
      pickNested(raw, [["wellness", "weight_kg"], ["wellness", "weight"], ["metrics", "weight_kg"]])
  );
  const bodyFatPct = toNumber(
    pick(raw, ["body_fat_pct", "body_fat", "fat_pct", "bodyfat"]) ??
      pickNested(raw, [["wellness", "body_fat_pct"], ["wellness", "body_fat"], ["metrics", "body_fat_pct"]])
  );
  const workoutId = rawId ? String(rawId) : makeWorkoutId(name, startDate);

  return {
    workout_id: workoutId,
    name: name || "Intervals workout",
    start_date: startDate || new Date().toISOString(),
    duration_min: durationMin,
    distance_km: distanceKm,
    elevation_m: elevationM,
    avg_power: avgPower,
    np,
    avg_hr: avgHr,
    max_hr: maxHr,
    tss,
    if_value: ifValue,
    sleep_hours: sleepHours,
    hrv_ms: hrvMs,
    rhr_bpm: rhrBpm,
    weight_kg: weightKg,
    body_fat_pct: bodyFatPct,
  };
}

async function upsertLatestWorkout(env, row) {
  const url = `${env.SUPABASE_URL}/rest/v1/intervals_latest_workouts?on_conflict=athlete_id`;
  const resp = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(env, {
      Prefer: "resolution=merge-duplicates,return=representation",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify([row]),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw httpError(502, `Supabase upsert failed: ${detail || resp.status}`);
  }
}

async function upsertWorkoutHistory(env, rows) {
  const url = `${env.SUPABASE_URL}/rest/v1/intervals_workouts_history?on_conflict=athlete_id,workout_id`;
  const resp = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(env, {
      Prefer: "resolution=merge-duplicates,return=minimal",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw httpError(502, `Supabase history upsert failed: ${detail || resp.status}`);
  }
}

async function getLatestWorkout(env, athleteId) {
  const query = new URLSearchParams({
    athlete_id: `eq.${athleteId}`,
    select: "athlete_id,synced_at,source_file,workout",
    order: "synced_at.desc",
    limit: "1",
  });

  const url = `${env.SUPABASE_URL}/rest/v1/intervals_latest_workouts?${query.toString()}`;
  const resp = await fetch(url, {
    headers: supabaseHeaders(env),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw httpError(502, `Supabase read failed: ${detail || resp.status}`);
  }

  const rows = await resp.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  return {
    athleteId: row.athlete_id,
    syncedAt: row.synced_at,
    sourceFile: row.source_file,
    workout: row.workout || null,
  };
}

async function getWorkoutHistory(env, athleteId, days) {
  const since = isoDateDaysAgo(days);
  const query = new URLSearchParams({
    athlete_id: `eq.${athleteId}`,
    workout_date: `gte.${since}`,
    select: "athlete_id,workout_id,workout_date,synced_at,source_file,workout",
    order: "workout_date.asc",
    limit: "5000",
  });

  const url = `${env.SUPABASE_URL}/rest/v1/intervals_workouts_history?${query.toString()}`;
  const resp = await fetch(url, {
    headers: supabaseHeaders(env),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw httpError(502, `Supabase history read failed: ${detail || resp.status}`);
  }
  const rows = await resp.json();
  return Array.isArray(rows) ? rows : [];
}

function supabaseHeaders(env, extra = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw httpError(500, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

function requireClientToken(request, env) {
  const token = request.headers.get("x-client-token") || "";
  if (!env.CLIENT_SYNC_TOKEN || token !== env.CLIENT_SYNC_TOKEN) {
    throw httpError(401, "Unauthorized client token");
  }
}

function requireAdminToken(request, env) {
  const token = request.headers.get("x-admin-key") || "";
  if (!env.ADMIN_SYNC_KEY || token !== env.ADMIN_SYNC_KEY) {
    throw httpError(401, "Unauthorized admin key");
  }
}

function getAthleteId(url, env) {
  const athlete = (url.searchParams.get("athlete") || env.DEFAULT_ATHLETE_ID || "default").trim().toLowerCase();
  if (!athlete) throw httpError(400, "athlete missing");
  return athlete;
}

function getBackfillDays(url) {
  const raw = Number(url.searchParams.get("days") || "365");
  if (!Number.isFinite(raw)) return 365;
  return Math.max(7, Math.min(1825, Math.round(raw)));
}

function toNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function toMinutes(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 1000 ? value / 60 : value;
  }

  const s = String(value).trim().toLowerCase();
  if (!s) return null;

  if (s.includes(":")) {
    const p = s.split(":").map(Number);
    if (p.some((x) => !Number.isFinite(x))) return null;
    if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
    if (p.length === 2) return p[0] + p[1] / 60;
  }

  const n = toNumber(s);
  if (!Number.isFinite(n)) return null;
  if (/\b(sec|second|seconds)\b/.test(s)) return n / 60;
  if (/\b(hour|hours|hr|hrs|uur|uren)\b/.test(s)) return n * 60;
  return n;
}

function toKilometers(value) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return null;
  // Intervals often returns meters for distance; convert if value is too large for km.
  if (n > 300) return n / 1000;
  return n;
}

function toHours(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 24 ? value / 3600 : value;
  }
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (s.includes(":")) {
    const p = s.split(":").map(Number);
    if (p.some((x) => !Number.isFinite(x))) return null;
    if (p.length === 3) return p[0] + p[1] / 60 + p[2] / 3600;
    if (p.length === 2) return p[0] + p[1] / 60;
  }
  const n = toNumber(s);
  if (!Number.isFinite(n)) return null;
  if (/\b(sec|second|seconds)\b/.test(s)) return n / 3600;
  if (/\b(min|mins|minute|minutes)\b/.test(s)) return n / 60;
  return n;
}

function pick(obj, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
}

function pickNested(obj, paths) {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path) {
      if (!cur || typeof cur !== "object" || !(key in cur)) {
        ok = false;
        break;
      }
      cur = cur[key];
    }
    if (ok && cur != null && cur !== "") return cur;
  }
  return null;
}

function makeWorkoutId(name, startDate) {
  const base = `${name || "workout"}|${startDate || ""}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `w-${hash.toString(16)}`;
}

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function withIntervalsQuery(endpoint, opts) {
  const url = new URL(endpoint);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));
  if (opts.oldest) url.searchParams.set("oldest", String(opts.oldest));
  if (opts.newest) url.searchParams.set("newest", String(opts.newest));
  return url.toString();
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type,x-client-token,x-admin-key");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return new Response(response.body, { ...response, headers });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function encodeBase64(input) {
  return btoa(input);
}
