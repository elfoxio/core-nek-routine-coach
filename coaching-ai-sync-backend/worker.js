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

      if (path === "/api/client/sync" && request.method === "POST") {
        requireClientToken(request, env);
        const athlete = getAthleteId(url, env);
        const result = await runSync(env, athlete);
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

async function fetchIntervalsLatest(env) {
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

  const resp = await fetch(endpoint, { headers });
  if (!resp.ok) {
    const detail = await resp.text();
    throw httpError(502, `Intervals API error ${resp.status}: ${detail.slice(0, 300)}`);
  }

  const data = await resp.json();
  if (Array.isArray(data)) return data[0] || null;
  if (Array.isArray(data?.results)) return data.results[0] || null;
  if (Array.isArray(data?.items)) return data.items[0] || null;
  if (Array.isArray(data?.activities)) return data.activities[0] || null;
  if (data?.activity) return data.activity;
  return data;
}

function mapIntervalsWorkout(raw) {
  if (!raw || typeof raw !== "object") return null;

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

  return {
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

function pick(obj, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
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
