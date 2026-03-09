const STORAGE_KEY = "healthDashboard.lastJson";
const MAX_BROWSER_PARSE_BYTES = 200 * 1024 * 1024;

const jsonInput = document.getElementById("jsonInput");
const loadSavedBtn = document.getElementById("loadSavedBtn");
const clearSavedBtn = document.getElementById("clearSavedBtn");
const copyWizardCmdBtn = document.getElementById("copyWizardCmdBtn");
const wizardCmd = document.getElementById("wizardCmd");
const statusEl = document.getElementById("status");
const kpisEl = document.getElementById("kpis");
const trendTableEl = document.getElementById("trendTable");
const adviceListEl = document.getElementById("adviceList");
const monthlyTable = document.getElementById("monthlyTable");
const stepsChart = document.getElementById("stepsChart");
const sleepChart = document.getElementById("sleepChart");

jsonInput.addEventListener("change", onFileSelected);
loadSavedBtn.addEventListener("click", onLoadSaved);
clearSavedBtn.addEventListener("click", onClearSaved);
if (copyWizardCmdBtn && wizardCmd) {
  copyWizardCmdBtn.addEventListener("click", onCopyWizardCommand);
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function parseDate(str) {
  if (typeof str !== "string") return null;
  let s = str.trim();
  if (s.length >= 6 && s[s.length - 3] === ":" && ["+", "-"].includes(s[s.length - 6])) {
    s = s.slice(0, -3) + s.slice(-2);
  }
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/,
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  ];
  for (const re of formats) {
    const m = s.match(re);
    if (m) {
      const [_, y, mo, d, h, mi, sec] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec));
    }
  }
  return null;
}

function toNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function round(v, d = 2) {
  if (!Number.isFinite(v)) return "-";
  return v.toFixed(d);
}

function pct(delta, base) {
  if (!Number.isFinite(delta) || !Number.isFinite(base) || base === 0) return "n.v.t.";
  return `${(delta / base * 100).toFixed(1)}%`;
}

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_BROWSER_PARSE_BYTES) {
    const gb = (file.size / (1024 ** 3)).toFixed(2);
    setStatus(
      `Bestand is ${gb} GB en te groot voor directe browser-analyse. Gebruik eerst de compacte export via: python3 health-analysis/export_dashboard_payload.py "<pad-naar-json>".`
    );
    return;
  }
  setStatus(`Bezig met verwerken: ${file.name}...`);
  try {
    const text = await file.text();
    localStorage.setItem(STORAGE_KEY, text);
    const parsed = JSON.parse(text);
    processData(parsed);
    setStatus(`Geladen: ${file.name}`);
  } catch (err) {
    console.error(err);
    setStatus("Fout bij inladen. Controleer of dit een geldig HealthAutoExport JSON-bestand is.");
  }
}

function onLoadSaved() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    setStatus("Geen opgeslagen upload gevonden.");
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    processData(parsed);
    setStatus("Laatste opgeslagen upload geladen.");
  } catch {
    setStatus("Opgeslagen upload is ongeldig. Upload opnieuw een JSON-bestand.");
  }
}

function onClearSaved() {
  localStorage.removeItem(STORAGE_KEY);
  setStatus("Opgeslagen upload gewist.");
}

async function onCopyWizardCommand() {
  if (!wizardCmd) return;
  const cmd = wizardCmd.textContent || "";
  try {
    await navigator.clipboard.writeText(cmd);
    setStatus("Commando gekopieerd. Plak nu in Terminal en run.");
  } catch {
    setStatus("Kopieren via browser geblokkeerd. Selecteer en kopieer het commando handmatig.");
  }
}

function processData(root) {
  if (root?.dashboardPayloadVersion === 1) {
    const payload = root.payload || root;
    const { metricDaily, metricUnits, monthlyRows, workoutStats, trends, correlations, range } = payload;
    if (!metricDaily || !monthlyRows || !workoutStats || !trends || !correlations) {
      throw new Error("Ongeldig compact dashboardbestand");
    }
    renderKpis(workoutStats, range, metricDaily);
    renderTrends(trends, metricUnits || {});
    renderAdvice(trends, correlations, workoutStats, metricDaily);
    renderMonthlyTable(monthlyRows);
    renderLineChart(stepsChart, monthlyRows, "step_count", "#1f4b99");
    renderLineChart(sleepChart, monthlyRows, "sleep_hours_est", "#1d7a52");
    return;
  }

  const data = root?.data;
  if (!data || !Array.isArray(data.metrics) || !Array.isArray(data.workouts)) {
    throw new Error("Unexpected JSON shape");
  }

  const { metricDaily, metricUnits, monthlyRows, workoutStats, trends, correlations, range } = analyze(data);
  renderKpis(workoutStats, range, metricDaily);
  renderTrends(trends, metricUnits);
  renderAdvice(trends, correlations, workoutStats, metricDaily);
  renderMonthlyTable(monthlyRows);
  renderLineChart(stepsChart, monthlyRows, "step_count", "#1f4b99");
  renderLineChart(sleepChart, monthlyRows, "sleep_hours_est", "#1d7a52");
}

function analyze(data) {
  const metricDaily = {};
  const metricUnits = {};
  const avgMetrics = new Set([
    "resting_heart_rate",
    "heart_rate",
    "heart_rate_variability",
    "walking_heart_rate_average",
    "respiratory_rate",
    "blood_oxygen_saturation",
    "walking_speed",
    "cycling_speed",
    "weight_body_mass",
    "body_mass_index",
    "body_fat_percentage",
    "physical_effort",
  ]);

  for (const metric of data.metrics) {
    const name = metric?.name;
    if (!name) continue;
    metricUnits[name] = metric?.units || "";

    if (name === "sleep_analysis") {
      const byDay = {};
      for (const p of metric.data || []) {
        const dt = parseDate(p?.start) || parseDate(p?.end);
        if (!dt) continue;
        const day = dt.toISOString().slice(0, 10);
        const core = toNum(p?.core) || 0;
        const rem = toNum(p?.rem) || 0;
        const deep = toNum(p?.deep) || 0;
        const asleep = toNum(p?.asleep) || 0;
        const total = toNum(p?.totalSleep) || 0;
        const estimate = total > 0 ? total : asleep > 0 ? asleep : core + rem + deep;
        byDay[day] = estimate;
      }
      metricDaily.sleep_hours_est = byDay;
      metricUnits.sleep_hours_est = "hr";
      continue;
    }

    const tmp = {};
    for (const p of metric.data || []) {
      const qty = toNum(p?.qty);
      if (qty === null) continue;
      const dt = parseDate(p?.start) || parseDate(p?.date) || parseDate(p?.end);
      if (!dt) continue;
      const day = dt.toISOString().slice(0, 10);
      if (!tmp[day]) tmp[day] = [];
      tmp[day].push(qty);
    }

    const byDay = {};
    for (const [day, arr] of Object.entries(tmp)) {
      byDay[day] = avgMetrics.has(name) ? average(arr) : arr.reduce((a, b) => a + b, 0);
    }
    metricDaily[name] = byDay;
  }

  const targetMetrics = [
    "step_count",
    "walking_running_distance",
    "active_energy",
    "sleep_hours_est",
    "resting_heart_rate",
    "heart_rate_variability",
    "walking_heart_rate_average",
    "weight_body_mass",
  ];

  const allMonths = [...new Set(targetMetrics.flatMap((m) => Object.keys(metricDaily[m] || {}).map((d) => d.slice(0, 7))))].sort();
  const monthlyRows = allMonths.map((month) => {
    const row = { month };
    for (const metricName of targetMetrics) {
      const vals = Object.entries(metricDaily[metricName] || {})
        .filter(([d]) => d.startsWith(month))
        .map(([, v]) => v);
      row[metricName] = vals.length ? average(vals) : null;
    }
    return row;
  });

  const workoutTypes = {};
  let totalMinutes = 0;
  for (const w of data.workouts) {
    const n = w?.name || "unknown";
    workoutTypes[n] = (workoutTypes[n] || 0) + 1;
    const s = parseDate(w?.start);
    const e = parseDate(w?.end);
    if (s && e) {
      const min = (e - s) / 60000;
      if (min > 0) totalMinutes += min;
    }
  }

  const sortedTypes = Object.entries(workoutTypes).sort((a, b) => b[1] - a[1]);
  const workoutStats = {
    count: data.workouts.length,
    minutesTotal: totalMinutes,
    minutesAvg: data.workouts.length ? totalMinutes / data.workouts.length : 0,
    topTypes: sortedTypes.slice(0, 5),
  };

  const trends = {};
  for (const name of targetMetrics) {
    const points = Object.entries(metricDaily[name] || {}).sort((a, b) => a[0].localeCompare(b[0]));
    if (!points.length) continue;
    const vals = points.map(([, v]) => v);
    const first = average(vals.slice(0, 30));
    const last = average(vals.slice(-30));
    if (first === null || last === null) continue;
    trends[name] = { first, last, delta: last - first };
  }

  const correlations = {
    stepsDistance: correlation(metricDaily.step_count || {}, metricDaily.walking_running_distance || {}),
    stepsEnergy: correlation(metricDaily.step_count || {}, metricDaily.active_energy || {}),
    stepsRhr: correlation(metricDaily.step_count || {}, metricDaily.resting_heart_rate || {}),
  };

  const allDays = Object.values(metricDaily)
    .flatMap((obj) => Object.keys(obj || {}))
    .sort();
  const range = allDays.length ? { start: allDays[0], end: allDays[allDays.length - 1] } : null;

  return { metricDaily, metricUnits, monthlyRows, workoutStats, trends, correlations, range };
}

function correlation(a, b) {
  const keys = Object.keys(a).filter((k) => k in b).sort();
  if (keys.length < 3) return null;
  const xs = keys.map((k) => a[k]);
  const ys = keys.map((k) => b[k]);
  const mx = average(xs);
  const my = average(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const xv = xs[i] - mx;
    const yv = ys[i] - my;
    num += xv * yv;
    dx += xv * xv;
    dy += yv * yv;
  }
  const den = Math.sqrt(dx * dy);
  if (!den) return null;
  return { r: num / den, n: keys.length };
}

function renderKpis(workoutStats, range, metricDaily) {
  const sleepVals = Object.values(metricDaily.sleep_hours_est || {});
  const stepVals = Object.values(metricDaily.step_count || {});
  const rhrVals = Object.values(metricDaily.resting_heart_rate || {});

  const items = [
    ["Periode", range ? `${range.start} t/m ${range.end}` : "-"],
    ["Workouts", String(workoutStats.count)],
    ["Gem. minuten/workout", round(workoutStats.minutesAvg, 1)],
    ["Gem. stappen/dag", stepVals.length ? round(average(stepVals), 0) : "-"],
    ["Gem. slaap (u)", sleepVals.length ? round(average(sleepVals), 2) : "-"],
    ["Gem. rusthartslag", rhrVals.length ? `${round(average(rhrVals), 1)} bpm` : "-"],
  ];

  kpisEl.innerHTML = "";
  for (const [label, value] of items) {
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<span class="label">${label}</span><span class="value">${value}</span>`;
    kpisEl.appendChild(div);
  }
}

function renderTrends(trends, units) {
  const labels = [
    ["step_count", "Stappen"],
    ["walking_running_distance", "Wandel/loop afstand"],
    ["active_energy", "Active energy"],
    ["sleep_hours_est", "Slaap"],
    ["resting_heart_rate", "Rusthartslag"],
    ["heart_rate_variability", "HRV"],
    ["weight_body_mass", "Gewicht"],
  ];

  const rows = labels
    .filter(([key]) => trends[key])
    .map(([key, label]) => {
      const t = trends[key];
      const unit = units[key] || "";
      return `<tr>
        <td>${label}</td>
        <td>${round(t.first, 2)} ${unit}</td>
        <td>${round(t.last, 2)} ${unit}</td>
        <td>${round(t.delta, 2)} (${pct(t.delta, t.first)})</td>
      </tr>`;
    })
    .join("");

  trendTableEl.innerHTML = `
    <table>
      <thead>
        <tr><th>Metric</th><th>Eerste 30d</th><th>Laatste 30d</th><th>Verschil</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAdvice(trends, correlations, workoutStats, metricDaily) {
  const advice = [];

  const sleep = trends.sleep_hours_est;
  if (sleep) {
    if (sleep.last < 7) {
      advice.push("Slaap zit onder 7u. Prioriteer 7.5-8.5u/nacht met vaste bedtijd en minder schermlicht het laatste uur.");
    } else if (sleep.delta > 0.5) {
      advice.push("Slaap verbeterde duidelijk. Behoud deze routine en bescherm je bedtijd op drukke weken.");
    }
  }

  const rhr = trends.resting_heart_rate;
  if (rhr && rhr.delta > 2) {
    advice.push("Rusthartslag stijgt. Plan elke 4e week een deload (30-40% minder intensiteit/volume) en voeg 1 extra hersteldag toe.");
  }

  const steps = trends.step_count;
  const dist = trends.walking_running_distance;
  if (steps && dist && steps.delta > 0 && dist.delta < 0) {
    advice.push("Stappen gaan omhoog maar afstand daalt. Voeg 2-3 langere zone-2 sessies van 45-90 min toe voor duurbasis.");
  }

  const hrv = trends.heart_rate_variability;
  if (hrv && hrv.delta > 5) {
    advice.push("HRV trend is positief. Houd belasting geleidelijk opbouwend en vermijd twee zware intensieve dagen na elkaar.");
  }

  const weight = trends.weight_body_mass;
  if (weight && weight.delta > 0.8) {
    advice.push("Gewicht steeg licht. Als dit onbedoeld is: richt op 250-350 kcal/dag minder en 1.6-2.0 g eiwit/kg/dag.");
  }

  if (correlations.stepsDistance && correlations.stepsDistance.r > 0.6) {
    advice.push("Je stappen en afstand hangen sterk samen. Een vaste dagelijkse wandel-/fietsroutine zal je totale volume betrouwbaar verhogen.");
  }

  const top = workoutStats.topTypes.map(([name, count]) => `${name} (${count})`).join(", ");
  advice.push(`Top workouttypes: ${top}. Voor wielrennen: voeg 2x/week 20-30 min kracht (core/heup/rug) toe voor blessurepreventie.`);

  if (!advice.length) {
    advice.push("Nog onvoldoende data voor scherp advies. Upload een langere periode voor betrouwbaardere trends.");
  }

  adviceListEl.innerHTML = advice.map((x) => `<li>${x}</li>`).join("");
}

function renderMonthlyTable(rows) {
  const columns = [
    ["month", "Maand"],
    ["step_count", "Stappen"],
    ["walking_running_distance", "Afstand km"],
    ["active_energy", "Active energy kJ"],
    ["sleep_hours_est", "Slaap u"],
    ["resting_heart_rate", "Rust-HR"],
    ["heart_rate_variability", "HRV"],
    ["weight_body_mass", "Gewicht"],
  ];

  monthlyTable.querySelector("thead").innerHTML = `<tr>${columns.map(([, l]) => `<th>${l}</th>`).join("")}</tr>`;
  monthlyTable.querySelector("tbody").innerHTML = rows
    .map((row) => `<tr>${columns.map(([k]) => `<td>${k === "month" ? row[k] || "-" : row[k] == null ? "-" : round(row[k], 2)}</td>`).join("")}</tr>`)
    .join("");
}

function renderLineChart(container, rows, key, color) {
  const data = rows.filter((r) => Number.isFinite(r[key]));
  if (!data.length) {
    container.innerHTML = "<p>Geen data</p>";
    return;
  }

  const width = 640;
  const height = 220;
  const pad = 28;
  const vals = data.map((r) => r[key]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const points = data
    .map((r, i) => {
      const x = pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
      const y = height - pad - ((r[key] - min) * (height - pad * 2)) / span;
      return `${x},${y}`;
    })
    .join(" ");

  const dots = data
    .map((r, i) => {
      const x = pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
      const y = height - pad - ((r[key] - min) * (height - pad * 2)) / span;
      return `<circle class="dot" cx="${x}" cy="${y}" r="2.8"></circle>`;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line class="axis" x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"></line>
      <line class="axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}"></line>
      <polyline class="line" style="stroke:${color}" points="${points}"></polyline>
      ${dots}
      <text x="${pad}" y="${pad - 8}" font-size="11" fill="#4d5a73">max ${round(max, 1)}</text>
      <text x="${pad}" y="${height - 8}" font-size="11" fill="#4d5a73">min ${round(min, 1)}</text>
    </svg>
  `;
}

onLoadSaved();
