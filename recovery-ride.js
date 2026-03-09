const STORAGE_KEY = "recoveryRide.v1";

const state = loadState();

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const logoutBtn = document.getElementById("logoutBtn");

const checkinForm = document.getElementById("checkinForm");
const entryDate = document.getElementById("entryDate");
const screenshotInput = document.getElementById("screenshotInput");
const screenshotPreview = document.getElementById("screenshotPreview");
const ocrStatus = document.getElementById("ocrStatus");
const ocrRaw = document.getElementById("ocrRaw");

const todayStatus = document.getElementById("todayStatus");
const trendCards = document.getElementById("trendCards");
const calendar = document.getElementById("calendar");
const notesList = document.getElementById("notesList");
const coachSummary = document.getElementById("coachSummary");

const refreshCoachBtn = document.getElementById("refreshCoachBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const workoutNameInput = document.getElementById("workoutNameInput");
const workoutSportInput = document.getElementById("workoutSportInput");
const workoutFormatInput = document.getElementById("workoutFormatInput");
const workoutDurationInput = document.getElementById("workoutDurationInput");
const workoutStructureInput = document.getElementById("workoutStructureInput");
const workoutWarmupInput = document.getElementById("workoutWarmupInput");
const buildWorkoutBtn = document.getElementById("buildWorkoutBtn");
const downloadWorkoutBtn = document.getElementById("downloadWorkoutBtn");
const workoutPreview = document.getElementById("workoutPreview");
const workoutStatus = document.getElementById("workoutStatus");
const autoPresetBtn = document.getElementById("autoPresetBtn");
const autoPresetModeInput = document.getElementById("autoPresetModeInput");
const intervalsCsvInput = document.getElementById("intervalsCsvInput");
const clearIntervalsBtn = document.getElementById("clearIntervalsBtn");
const intervalsStatus = document.getElementById("intervalsStatus");
const intervalsSummary = document.getElementById("intervalsSummary");
const intervalsTips = document.getElementById("intervalsTips");

let lastWorkoutBuild = null;

const fields = {
  sleep: document.getElementById("sleepInput"),
  hrv: document.getElementById("hrvInput"),
  rhr: document.getElementById("rhrInput"),
  load: document.getElementById("loadInput"),
  weight: document.getElementById("weightInput"),
  fat: document.getElementById("fatInput"),
  neck: document.getElementById("neckInput"),
  scapula: document.getElementById("scapulaInput"),
  energy: document.getElementById("energyInput"),
  stress: document.getElementById("stressInput"),
  motivation: document.getElementById("motivationInput"),
  gi: document.getElementById("giInput"),
  notes: document.getElementById("notesInput"),
};

const sliderMirrors = [
  ["neckInput", "neckVal"],
  ["scapulaInput", "scapulaVal"],
  ["energyInput", "energyVal"],
  ["stressInput", "stressVal"],
  ["motivationInput", "motivationVal"],
  ["giInput", "giVal"],
];

for (const [sliderId, labelId] of sliderMirrors) {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  slider.addEventListener("input", () => {
    label.textContent = slider.value;
  });
}

loginForm.addEventListener("submit", onLogin);
logoutBtn.addEventListener("click", onLogout);
checkinForm.addEventListener("submit", onSaveCheckin);
screenshotInput.addEventListener("change", onScreenshotUpload);
refreshCoachBtn.addEventListener("click", renderCoachAdvice);
exportCsvBtn.addEventListener("click", exportCsv);
exportPdfBtn.addEventListener("click", printSummary);
buildWorkoutBtn.addEventListener("click", onBuildWorkout);
downloadWorkoutBtn.addEventListener("click", onDownloadWorkout);
autoPresetBtn.addEventListener("click", onAutoPresetClick);
intervalsCsvInput.addEventListener("change", onIntervalsCsvUpload);
clearIntervalsBtn.addEventListener("click", onClearIntervalsAnalysis);
document.querySelectorAll(".preset-btn[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => onPresetClick(btn.dataset.preset));
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    selectTab(tab.dataset.tab);
  });
});

init();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      user: saved.user || null,
      entries: saved.entries || {},
      intervalsAnalysis: saved.intervalsAnalysis || null,
    };
  } catch {
    return { user: null, entries: {}, intervalsAnalysis: null };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function init() {
  entryDate.value = todayISO();
  if (state.user?.name) {
    showApp();
    loadEntryIntoForm(entryDate.value);
  } else {
    showLogin();
  }

  entryDate.addEventListener("change", () => {
    loadEntryIntoForm(entryDate.value);
  });

  renderDashboard();
  renderCoachAdvice();
  renderIntervalsAnalysis();
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

function onLogin(event) {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  state.user = {
    name,
    email: emailInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  saveState();
  showApp();
}

function onLogout() {
  state.user = null;
  saveState();
  showLogin();
}

function selectTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

function onSaveCheckin(event) {
  event.preventDefault();
  const date = entryDate.value;
  if (!date) return;

  const existing = state.entries[date] || {};
  state.entries[date] = {
    ...existing,
    date,
    metrics: {
      sleep: toNum(fields.sleep.value),
      hrv: toNum(fields.hrv.value),
      rhr: toNum(fields.rhr.value),
      load: toNum(fields.load.value),
      weight: toNum(fields.weight.value),
      fat: toNum(fields.fat.value),
    },
    subjective: {
      neck: toNum(fields.neck.value) || 0,
      scapula: toNum(fields.scapula.value) || 0,
      energy: toNum(fields.energy.value) || 0,
      stress: toNum(fields.stress.value) || 0,
      motivation: toNum(fields.motivation.value) || 0,
      gi: toNum(fields.gi.value) || 0,
    },
    notes: fields.notes.value.trim(),
    updatedAt: new Date().toISOString(),
    source: existing.source || "manual",
    ocrRaw: existing.ocrRaw || "",
  };

  saveState();
  renderDashboard();
  renderCoachAdvice();
}

function loadEntryIntoForm(date) {
  const e = state.entries[date];
  if (!e) {
    fields.sleep.value = "";
    fields.hrv.value = "";
    fields.rhr.value = "";
    fields.load.value = "";
    fields.weight.value = "";
    fields.fat.value = "";
    fields.neck.value = 3;
    fields.scapula.value = 3;
    fields.energy.value = 6;
    fields.stress.value = 4;
    fields.motivation.value = 6;
    fields.gi.value = 1;
    fields.notes.value = "";
    refreshSliderLabels();
    return;
  }

  fields.sleep.value = e.metrics?.sleep ?? "";
  fields.hrv.value = e.metrics?.hrv ?? "";
  fields.rhr.value = e.metrics?.rhr ?? "";
  fields.load.value = e.metrics?.load ?? "";
  fields.weight.value = e.metrics?.weight ?? "";
  fields.fat.value = e.metrics?.fat ?? "";
  fields.neck.value = e.subjective?.neck ?? 3;
  fields.scapula.value = e.subjective?.scapula ?? 3;
  fields.energy.value = e.subjective?.energy ?? 6;
  fields.stress.value = e.subjective?.stress ?? 4;
  fields.motivation.value = e.subjective?.motivation ?? 6;
  fields.gi.value = e.subjective?.gi ?? 1;
  fields.notes.value = e.notes || "";
  refreshSliderLabels();
}

function refreshSliderLabels() {
  for (const [sliderId, labelId] of sliderMirrors) {
    document.getElementById(labelId).textContent = document.getElementById(sliderId).value;
  }
}

async function onScreenshotUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  screenshotPreview.src = URL.createObjectURL(file);
  screenshotPreview.classList.remove("hidden");

  if (!window.Tesseract) {
    ocrStatus.textContent = "OCR library niet beschikbaar. Vul velden manueel in.";
    return;
  }

  ocrStatus.textContent = "OCR bezig...";

  try {
    const source = await preprocessImage(file);
    const primary = await runOcr(source, "OCR pass 1/2");
    let rawText = primary?.data?.text || "";
    let extracted = extractGarminMetrics(rawText);

    // If first pass is too noisy, retry on the original image and merge.
    if (countExtracted(extracted) < 2) {
      const secondary = await runOcr(file, "OCR pass 2/2");
      const fallbackText = secondary?.data?.text || "";
      const fallbackExtracted = extractGarminMetrics(fallbackText);
      extracted = mergeExtracted(extracted, fallbackExtracted);
      rawText = [rawText, "\n\n--- OCR fallback ---\n", fallbackText].join("");
    }

    ocrRaw.textContent = rawText;
    applyExtractedValues(extracted);

    const date = entryDate.value || todayISO();
    const prev = state.entries[date] || { date, metrics: {}, subjective: {} };
    state.entries[date] = {
      ...prev,
      source: "garmin-screenshot",
      ocrRaw: rawText,
      updatedAt: new Date().toISOString(),
    };
    saveState();

    const keys = Object.entries(extracted)
      .filter(([, value]) => value != null)
      .map(([key]) => key);
    ocrStatus.textContent = keys.length
      ? `OCR klaar. Gevonden: ${keys.join(", ")}. Controleer en klik daarna op Opslaan.`
      : "OCR klaar, maar geen betrouwbare Garmin-waarden gevonden. Controleer manueel.";
  } catch (err) {
    console.error(err);
    ocrStatus.textContent = "OCR mislukt. Controleer het screenshot of vul manueel in.";
  }
}

async function runOcr(source, label) {
  return window.Tesseract.recognize(source, "eng", {
    logger: (msg) => {
      if (msg.status === "recognizing text") {
        ocrStatus.textContent = `${label}... ${Math.round((msg.progress || 0) * 100)}%`;
      }
    },
  });
}

function countExtracted(extracted) {
  return Object.values(extracted).filter((v) => v != null).length;
}

function mergeExtracted(primary, fallback) {
  return {
    sleep: primary.sleep ?? fallback.sleep ?? null,
    hrv: primary.hrv ?? fallback.hrv ?? null,
    rhr: primary.rhr ?? fallback.rhr ?? null,
    load: primary.load ?? fallback.load ?? null,
    weight: primary.weight ?? fallback.weight ?? null,
    fat: primary.fat ?? fallback.fat ?? null,
  };
}

function extractGarminMetrics(text) {
  const normalized = text.replace(/,/g, ".").toLowerCase();
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fromKeywords = {
    sleep: readMetric(lines, ["sleep", "slaap", "slcep"], 2, 15, ["h", "hr", "hour", "uur"]),
    hrv: readMetric(lines, ["hrv", "variability", "variabil"], 10, 200, []),
    rhr: readMetric(lines, ["resting", "rest", "rust", "rhr"], 30, 120, ["bpm"]),
    load: readMetric(lines, ["training load", "load", "belasting"], 10, 2000, []),
    weight: readMetric(lines, ["weight", "gewicht", "massa"], 35, 200, ["kg"]),
    fat: readMetric(lines, ["body fat", "fat", "vet", "bodyfat"], 2, 60, ["%", "pct"]),
  };

  // Fallbacks tuned for Garmin dashboard screenshots with noisy OCR.
  const sleep = fromKeywords.sleep ?? extractSleepHours(normalized);
  const hrv = fromKeywords.hrv ?? extractUnitNumber(normalized, "ms", 10, 200);
  const rhr = fromKeywords.rhr ?? extractLikelyRhr(normalized);
  const weight = fromKeywords.weight ?? extractUnitNumber(normalized, "kg", 35, 200);
  const fat = fromKeywords.fat ?? extractFatPercent(normalized);
  const load = fromKeywords.load ?? extractTrainingLoad(normalized);

  return { sleep, hrv, rhr, load, weight, fat };
}

function readMetric(lines, keywords, min, max, unitsHint) {
  let fallback = null;
  for (const line of lines) {
    if (!keywords.some((k) => line.includes(k))) continue;
    const matches = line.match(/\d+(?:\.\d+)?/g);
    if (!matches) continue;
    const hasUnitHint = unitsHint.length ? unitsHint.some((u) => line.includes(u)) : false;

    for (const m of matches) {
      const n = Number(m);
      if (Number.isFinite(n) && n >= min && n <= max) {
        if (hasUnitHint || unitsHint.length === 0) return n;
        if (fallback == null) fallback = n;
      }
    }
  }
  return fallback;
}

function extractUnitNumber(text, unit, min, max) {
  const re = new RegExp(`(\\d{1,3}(?:\\.\\d+)?)\\s*${unit}\\b`, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= min && n <= max) return n;
  }
  return null;
}

function extractSleepHours(text) {
  const results = [];
  const re = /(\d{1,2})\s*h\s*(\d{1,2})\s*m/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) continue;
    if (h < 2 || h > 14 || min < 0 || min > 59) continue;
    const hours = h + min / 60;
    const context = text.slice(Math.max(0, m.index - 28), m.index + 32);
    const weighted = /sleep|slaap|duration|quality|score/.test(context);
    results.push({ hours, weighted });
  }
  if (!results.length) return null;
  const preferred = results.find((x) => x.weighted);
  return preferred ? preferred.hours : results[0].hours;
}

function extractLikelyRhr(text) {
  const re = /(\d{2,3}(?:\.\d+)?)\s*bpm\b/g;
  const candidates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 30 && n <= 120) candidates.push(n);
  }
  if (!candidates.length) return null;
  const calmRange = candidates.find((n) => n >= 42 && n <= 75);
  return calmRange ?? candidates[0];
}

function extractFatPercent(text) {
  // Prefer percent values near fat-related words.
  const keywordRe = /(fat|vet|body\s*fat)[^\n\r]{0,24}?(\d{1,2}(?:\.\d+)?)\s*%/i;
  const kw = text.match(keywordRe);
  if (kw) {
    const n = Number(kw[2]);
    if (Number.isFinite(n) && n >= 2 && n <= 60) return n;
  }
  const generic = extractUnitNumber(text, "%", 2, 60);
  return generic;
}

function extractTrainingLoad(text) {
  // Numeric load if present. Many Garmin overviews only show "Low/High" without a number.
  const re = /(training\s*load|load|belasting)[^\n\r]{0,30}?(\d{2,4}(?:\.\d+)?)/i;
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[2]);
  return Number.isFinite(n) && n >= 10 && n <= 2000 ? n : null;
}

function applyExtractedValues(extracted) {
  if (extracted.sleep != null) fields.sleep.value = extracted.sleep;
  if (extracted.hrv != null) fields.hrv.value = extracted.hrv;
  if (extracted.rhr != null) fields.rhr.value = extracted.rhr;
  if (extracted.load != null) fields.load.value = extracted.load;
  if (extracted.weight != null) fields.weight.value = extracted.weight;
  if (extracted.fat != null) fields.fat.value = extracted.fat;
}

async function preprocessImage(file) {
  try {
    const img = await fileToImage(file);
    const canvas = document.createElement("canvas");

    const scale = Math.max(1.6, 1800 / Math.max(1, img.width));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const boosted = luma > 150 ? 255 : luma < 90 ? 0 : Math.round(luma * 1.08);
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  } catch {
    return file;
  }
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function getSortedEntries() {
  return Object.values(state.entries).sort((a, b) => a.date.localeCompare(b.date));
}

function computeStatus(entry) {
  if (!entry) return { color: "orange", label: "Nog geen data", score: 0 };

  const m = entry.metrics || {};
  const s = entry.subjective || {};

  let score = 0;

  if (num(m.sleep) >= 7) score += 2;
  else if (num(m.sleep) >= 6) score += 1;
  else if (num(m.sleep) > 0) score -= 2;

  if (num(m.hrv) >= 55) score += 1;
  else if (num(m.hrv) > 0 && num(m.hrv) < 35) score -= 2;

  if (num(m.rhr) > 0 && num(m.rhr) <= 56) score += 1;
  else if (num(m.rhr) >= 65) score -= 2;

  if (num(m.load) > 0 && num(m.load) <= 550) score += 1;
  else if (num(m.load) >= 750) score -= 2;

  if (num(s.neck) >= 7 || num(s.scapula) >= 7) score -= 2;
  if (num(s.energy) <= 3) score -= 2;
  if (num(s.stress) >= 8) score -= 2;
  if (num(s.motivation) <= 3) score -= 1;
  if (num(s.gi) >= 6) score -= 1;

  if (score >= 2) return { color: "green", label: "Groen: trainen kan", score };
  if (score >= -1) return { color: "orange", label: "Oranje: rustig, Z2 of wandelen", score };
  return { color: "red", label: "Rood: herstel, mobiliteit, ontspanning", score };
}

function renderDashboard() {
  const entries = getSortedEntries();
  const latest = entries[entries.length - 1];
  const status = computeStatus(latest);

  todayStatus.className = "status-box";
  todayStatus.classList.add(`status-${status.color}`);
  todayStatus.textContent = latest
    ? `${latest.date} - ${status.label} (score ${status.score})`
    : "Nog geen check-in opgeslagen.";

  renderTrendCards(entries);
  renderCalendar(entries);
  renderNotes(entries);
}

function renderTrendCards(entries) {
  const defs = [
    ["hrv", "HRV"],
    ["rhr", "Rusthartslag"],
    ["weight", "Gewicht"],
    ["fat", "Vet%"],
    ["load", "Training load"],
  ];

  trendCards.innerHTML = defs
    .map(([key, label]) => {
      const points = entries
        .map((e) => ({ x: e.date, y: num(e.metrics?.[key]) }))
        .filter((p) => Number.isFinite(p.y))
        .slice(-21);
      const latest = points.length ? points[points.length - 1].y : null;
      return `
        <article class="trend-card">
          <h4>${label}</h4>
          <p>${latest == null ? "-" : latest}</p>
          ${sparkline(points)}
        </article>
      `;
    })
    .join("");
}

function sparkline(points) {
  if (!points.length) return '<svg class="spark" viewBox="0 0 220 120"><text x="12" y="60" fill="#5f6d75">Geen data</text></svg>';
  const width = 220;
  const height = 120;
  const pad = 12;
  const vals = points.map((p) => p.y);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const line = points
    .map((p, idx) => {
      const x = pad + (idx * (width - 2 * pad)) / Math.max(1, points.length - 1);
      const y = height - pad - ((p.y - min) * (height - 2 * pad)) / span;
      return `${x},${y}`;
    })
    .join(" ");

  return `
    <svg class="spark" viewBox="0 0 ${width} ${height}">
      <polyline fill="none" stroke="#1f5e52" stroke-width="2.4" points="${line}"></polyline>
      <text x="${pad}" y="12" font-size="11" fill="#53666d">max ${round(max, 1)}</text>
      <text x="${pad}" y="${height - 4}" font-size="11" fill="#53666d">min ${round(min, 1)}</text>
    </svg>
  `;
}

function renderCalendar(entries) {
  const byDate = Object.fromEntries(entries.map((e) => [e.date, e]));
  const days = [];
  for (let i = 34; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const entry = byDate[day];
    const status = entry ? computeStatus(entry) : null;
    days.push({ day, status });
  }

  calendar.innerHTML = days
    .map(({ day, status }) => {
      const cls = status ? `day day-${status.color}` : "day";
      const score = status ? `<span class="score">${status.score}</span>` : "<span class=\"score\">-</span>";
      return `<div class="${cls}" title="${day}">${day.slice(5)}${score}</div>`;
    })
    .join("");
}

function renderNotes(entries) {
  const notes = entries
    .filter((e) => e.notes)
    .slice(-10)
    .reverse();

  notesList.innerHTML = notes.length
    ? notes.map((e) => `<li><strong>${e.date}</strong>: ${escapeHtml(e.notes)}</li>`).join("")
    : "<li>Nog geen notities.</li>";
}

function renderCoachAdvice() {
  const entries = getSortedEntries();
  const latest = entries[entries.length - 1];
  if (!latest) {
    coachSummary.innerHTML = "<p>Sla eerst een check-in op om advies te genereren.</p>";
    return;
  }

  const status = computeStatus(latest);
  const tips = [];
  const workout = generateWorkout(latest, status);

  if (status.color === "green") {
    tips.push("Vandaag is geschikt voor training. Houd opwarming en cooldown consequent.");
  } else if (status.color === "orange") {
    tips.push("Hou de intensiteit laag: Z2, wandelen of korte herstelrit.");
  } else {
    tips.push("Focus op herstel: mobiliteit, ademhaling, slaap en geen intensiteit.");
  }

  const m = latest.metrics || {};
  const s = latest.subjective || {};

  if (num(m.sleep) > 0 && num(m.sleep) < 6.5) {
    tips.push("Slaap is te laag: plan vandaag een vroegere bedtijd en beperk cafeine na 14:00.");
  }
  if (num(s.stress) >= 7) {
    tips.push("Stress is hoog: voeg 10-15 min rustige ademhaling of korte wandeling toe tussen werkblokken.");
  }
  if (num(s.neck) >= 6 || num(s.scapula) >= 6) {
    tips.push("Nek/schouderbladklachten zijn verhoogd: kies voor mobiliteit en lichte core stabiliteit.");
  }
  if (num(s.gi) >= 6) {
    tips.push("Darmklachten zijn merkbaar: houd training kort en kies licht verteerbare voeding.");
  }
  if (state.intervalsAnalysis?.recoveryWindow) {
    tips.push(`Laatste Intervals workout: aanbevolen herstelvenster ${state.intervalsAnalysis.recoveryWindow}.`);
  }

  coachSummary.innerHTML = `
    <p><strong>Status:</strong> ${status.label}</p>
    <p><strong>Workout generator:</strong> ${workout}</p>
    <ul>${tips.map((t) => `<li>${t}</li>`).join("")}</ul>
  `;

  if (!workoutNameInput.value.trim()) {
    workoutNameInput.value = suggestWorkoutName(status, latest.date);
  }

  if (status.color === "red") {
    workoutStructureInput.value = "recovery";
    workoutDurationInput.value = 35;
  } else if (status.color === "orange") {
    workoutStructureInput.value = "z2";
    workoutDurationInput.value = 50;
  } else {
    workoutStructureInput.value = "z2";
    workoutDurationInput.value = 75;
  }
}

async function onIntervalsCsvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  intervalsStatus.textContent = `Bezig met analyseren: ${file.name}...`;

  try {
    const text = await file.text();
    const analysis = analyzeIntervalsCsv(text, file.name);
    state.intervalsAnalysis = analysis;
    saveState();
    renderIntervalsAnalysis();
    renderCoachAdvice();
    intervalsStatus.textContent = `Analyse klaar voor ${file.name}.`;
  } catch (err) {
    console.error(err);
    intervalsStatus.textContent = "Kon CSV niet analyseren. Controleer formaat/kolommen.";
  }
}

function onClearIntervalsAnalysis() {
  state.intervalsAnalysis = null;
  saveState();
  renderIntervalsAnalysis();
  renderCoachAdvice();
  intervalsStatus.textContent = "Intervals analyse gewist.";
}

function renderIntervalsAnalysis() {
  const a = state.intervalsAnalysis;
  if (!a) {
    intervalsSummary.innerHTML = "<p>Upload een Intervals CSV om post-workout analyse en recovery-advies te krijgen.</p>";
    intervalsTips.innerHTML = "<li>Nog geen tips beschikbaar.</li>";
    return;
  }

  intervalsSummary.innerHTML = `
    <p><strong>Workout:</strong> ${escapeHtml(a.activityName || "Onbekend")}</p>
    <p><strong>Datum:</strong> ${a.activityDate || "-"}</p>
    <p><strong>Bronbestand:</strong> ${escapeHtml(a.sourceFile || "-")}</p>
    <p><strong>Belasting:</strong> ${a.loadLabel} (score ${round(a.loadScore, 1)})</p>
    <p><strong>Hersteladvies:</strong> ${a.recoveryWindow}</p>
    <p><strong>Kerncijfers:</strong> duur ${a.durationMin ? `${round(a.durationMin, 1)} min` : "-"}, TSS ${valueOrDash(a.tss)}, IF ${valueOrDash(a.ifValue)}, NP ${valueOrDash(a.np)} W, avg HR ${valueOrDash(a.avgHr)} bpm</p>
  `;

  intervalsTips.innerHTML = a.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
}

function analyzeIntervalsCsv(text, filename) {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error("empty csv");
  const enriched = rows
    .map((row) => normalizeCsvRow(row))
    .filter((row) => Object.keys(row.normalized).length > 0);
  if (!enriched.length) throw new Error("no rows");

  const picked = pickBestWorkoutRow(enriched);
  const n = picked.normalized;

  const durationRaw = pickField(n, ["duration", "moving time", "elapsed", "time"]);
  const durationMin = parseDurationToMinutes(durationRaw);
  const distanceKm = parseDistanceKm(n);
  const elevationM = pickNumber(n, ["elevation", "elev gain", "elev", "ascent", "climb"]);
  const avgPower = pickNumber(n, ["average power", "avg power", "power avg"]);
  const np = pickNumber(n, ["normalized power", "np"]);
  const avgHr = pickNumber(n, ["average heart rate", "avg hr", "heartrate average", "avg heartrate"]);
  const maxHr = pickNumber(n, ["max heart rate", "max hr", "maximum heartrate", "max heartrate"]);
  const tss = pickNumber(n, ["tss", "training stress", "load"]);
  const ifDirect = pickNumber(n, ["intensity factor"]);
  const ftp = pickNumber(n, ["ftp"]);
  const ifValue = Number.isFinite(ifDirect) ? ifDirect : Number.isFinite(np) && Number.isFinite(ftp) && ftp > 0 ? np / ftp : null;
  const activityName = pickField(n, ["name", "activity", "workout", "title"]) || "Intervals workout";
  const activityDate = formatActivityDate(pickField(n, ["start", "date", "day", "timestamp"]));

  const loadScore = computeWorkoutLoadScore({ durationMin, tss, ifValue, maxHr, elevationM });
  const loadLabel = loadScore <= 3 ? "Licht" : loadScore <= 6 ? "Matig" : loadScore <= 9 ? "Hoog" : "Zeer hoog";
  const recoveryWindow =
    loadScore <= 3
      ? "12-24u: herstelrit of rustige duur mogelijk"
      : loadScore <= 6
        ? "24-36u: focus op Z1/Z2 en geen zware intensiteit"
        : loadScore <= 9
          ? "36-48u: geen intensiteit, vooral herstel"
          : "48-72u: actieve recuperatie en extra slaap/voeding";

  const tips = buildIntervalsTips({
    durationMin,
    tss,
    ifValue,
    avgHr,
    maxHr,
    distanceKm,
    elevationM,
    avgPower,
    np,
    loadScore,
  });

  return {
    sourceFile: filename,
    analyzedAt: new Date().toISOString(),
    activityName,
    activityDate,
    durationMin,
    distanceKm,
    elevationM,
    avgPower,
    np,
    avgHr,
    maxHr,
    tss,
    ifValue,
    loadScore,
    loadLabel,
    recoveryWindow,
    tips,
  };
}

function buildIntervalsTips(metrics) {
  const tips = [];
  const {
    durationMin,
    tss,
    ifValue,
    avgHr,
    maxHr,
    distanceKm,
    elevationM,
    loadScore,
  } = metrics;

  if (Number.isFinite(tss) && tss >= 90) {
    tips.push("Hoge trainingsstress: plan vandaag extra koolhydraten en een eiwitrijke recovery-maaltijd binnen 60 min.");
  } else {
    tips.push("Belasting is beheersbaar: hou herstel eenvoudig met hydratatie, lichte beweging en normale slaaproutine.");
  }

  if (Number.isFinite(ifValue) && ifValue >= 0.88) {
    tips.push("Intensiteit was hoog: vermijd morgen intensieve intervallen en kies herstel of Z2.");
  }

  if (Number.isFinite(durationMin) && durationMin >= 120) {
    tips.push("Lange sessie: focus op glycogeen-aanvulling en minimaal 8 uur slaap.");
  }

  if (Number.isFinite(maxHr) && Number.isFinite(avgHr) && maxHr - avgHr >= 35) {
    tips.push("Grote HR-spreiding: neem extra cooling-down en monitor ochtend-RHR/HRV voor je volgende kwaliteitstraining.");
  }

  if (Number.isFinite(elevationM) && elevationM >= 900) {
    tips.push("Veel hoogtemeters: voeg mobiliteit voor heup/rug en lichte kuit/hamstring reset toe.");
  }

  if (Number.isFinite(distanceKm) && distanceKm >= 100) {
    tips.push("Grote afstand: plan morgen een korte herstelprikkel (20-40 min zeer rustig) of volledige rust.");
  }

  if (loadScore >= 8) {
    tips.push("Belasting is hoog tot zeer hoog: schuif krachttraining 24-48u op om kwaliteit te behouden.");
  }

  if (!tips.length) {
    tips.push("Onvoldoende details in CSV voor gerichte tips. Controleer of export kolommen zoals duur, TSS, HR en vermogen bevat.");
  }

  return tips;
}

function computeWorkoutLoadScore({ durationMin, tss, ifValue, maxHr, elevationM }) {
  let score = 0;

  if (Number.isFinite(durationMin)) {
    if (durationMin >= 150) score += 3;
    else if (durationMin >= 90) score += 2;
    else if (durationMin >= 60) score += 1;
  }

  if (Number.isFinite(tss)) {
    if (tss >= 130) score += 4;
    else if (tss >= 100) score += 3;
    else if (tss >= 70) score += 2;
    else if (tss >= 40) score += 1;
  }

  if (Number.isFinite(ifValue)) {
    if (ifValue >= 0.95) score += 4;
    else if (ifValue >= 0.88) score += 3;
    else if (ifValue >= 0.8) score += 2;
    else if (ifValue >= 0.72) score += 1;
  }

  if (Number.isFinite(maxHr) && maxHr >= 175) score += 1;
  if (Number.isFinite(elevationM) && elevationM >= 900) score += 1;

  return score;
}

function parseCsvRows(text) {
  const lines = text.replace(/^\uFEFF/, "");
  const firstLine = lines.split(/\r?\n/).find((line) => line.trim().length > 0) || "";
  const delimiter = detectCsvDelimiter(firstLine);

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < lines.length; i += 1) {
    const char = lines[i];
    const next = lines[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((x) => x !== "")) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = vals[idx] ?? "";
    });
    return obj;
  });
}

function detectCsvDelimiter(line) {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function normalizeCsvRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    const nk = normalizeHeader(key);
    if (!nk) continue;
    normalized[nk] = value;
  }
  return { raw: row, normalized };
}

function normalizeHeader(header) {
  return String(header)
    .toLowerCase()
    .trim()
    .replace(/[%()]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[_-]/g, " ");
}

function pickBestWorkoutRow(rows) {
  let best = rows[rows.length - 1];
  let bestScore = -1;
  for (const row of rows) {
    const n = row.normalized;
    let score = 0;
    if (pickField(n, ["date", "start", "day"])) score += 2;
    if (parseDurationToMinutes(pickField(n, ["duration", "moving time", "elapsed", "time"])) > 0) score += 2;
    if (Number.isFinite(pickNumber(n, ["tss", "training stress"]))) score += 2;
    if (Number.isFinite(pickNumber(n, ["average power", "normalized power", "avg hr"]))) score += 1;
    if (score >= bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

function pickField(normalizedRow, keys) {
  for (const [header, value] of Object.entries(normalizedRow)) {
    if (keys.some((k) => headerMatches(header, k))) {
      const v = String(value || "").trim();
      if (v) return v;
    }
  }
  return "";
}

function headerMatches(header, key) {
  if (!header || !key) return false;
  const h = String(header);
  const k = String(key);
  if (k.length <= 3) {
    return h === k || h.startsWith(`${k} `) || h.endsWith(` ${k}`) || h.includes(` ${k} `);
  }
  return h.includes(k);
}

function pickNumber(normalizedRow, keys) {
  const raw = pickField(normalizedRow, keys);
  return parseSmartNumber(raw);
}

function parseSmartNumber(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s/g, "");
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDurationToMinutes(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  if (s.includes(":")) {
    const parts = s.split(":").map((x) => Number(x));
    if (parts.some((x) => !Number.isFinite(x))) return null;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
  }

  const numValue = parseSmartNumber(s);
  if (!Number.isFinite(numValue)) return null;

  if (/\b(sec|secs|second|seconds)\b/.test(s)) return numValue / 60;
  if (/\b(hour|hours|uur|uren|hr|hrs)\b/.test(s)) return numValue * 60;
  if (/\b(min|mins|minute|minutes)\b/.test(s)) return numValue;
  return numValue;
}

function parseDistanceKm(normalizedRow) {
  for (const [header, value] of Object.entries(normalizedRow)) {
    if (!header.includes("distance")) continue;
    const parsed = parseSmartNumber(value);
    if (!Number.isFinite(parsed)) continue;
    if (header.includes("mile")) return parsed * 1.60934;
    return parsed;
  }
  return null;
}

function formatActivityDate(rawDate) {
  if (!rawDate) return "-";
  const parsed = new Date(rawDate);
  if (!Number.isFinite(parsed.getTime())) return String(rawDate);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function valueOrDash(v, d = 2) {
  return Number.isFinite(v) ? round(v, d) : "-";
}

function generateWorkout(entry, status) {
  const s = entry.subjective || {};
  if (status.color === "red") {
    return "20-35 min wandelen + 12 min mobiliteit (nek/thoracaal/heup) + 5 min ademhaling.";
  }
  if (status.color === "orange") {
    if (num(s.energy) >= 6) {
      return "45-60 min rustige Z2 rit, cadans comfortabel, geen intensieve blokken.";
    }
    return "30-45 min wandelen of easy spin + 10 min core activatie.";
  }

  if (num(s.neck) >= 5 || num(s.scapula) >= 5) {
    return "60 min Z2 + 4x20 sec hoge cadans, zonder zware krachtblokken.";
  }
  return "60-90 min Z2 met optie 3x8 min sweet spot als RPE laag blijft.";
}

function suggestWorkoutName(status, date) {
  if (status.color === "red") return `Recovery Mobility ${date}`;
  if (status.color === "orange") return `Easy Endurance ${date}`;
  return `Endurance Builder ${date}`;
}

function onBuildWorkout() {
  const format = workoutFormatInput.value;
  const selectedSport = workoutSportInput.value;
  const sport = format === "zwo" ? "cycling" : selectedSport;
  const durationMin = clampInt(toNum(workoutDurationInput.value) || 60, 20, 180);
  const structure = workoutStructureInput.value;
  const warmup = workoutWarmupInput.value === "yes";
  const workoutName = (workoutNameInput.value || "Recovery Ride Workout").trim();

  const spec = buildWorkoutSpec(durationMin, structure, warmup);
  const build =
    format === "zwo"
      ? buildZwoWorkout(workoutName, sport, spec)
      : buildGarminWorkout(workoutName, sport, spec);

  lastWorkoutBuild = build;
  workoutPreview.textContent = build.preview;
  workoutStatus.textContent =
    format === "zwo" && selectedSport === "running"
      ? "ZWO ondersteunt hier enkel fietsoutput, daarom werd sport op fietsen gezet."
      : `Workout gegenereerd: ${build.filename}`;
}

function onPresetClick(presetId) {
  const today = entryDate.value || todayISO();
  const presetMap = {
    recovery: {
      name: `Recovery Reset ${today}`,
      duration: 35,
      structure: "recovery",
      warmup: "yes",
      sport: "cycling",
    },
    z2_60: {
      name: `Z2 Endurance 60 ${today}`,
      duration: 60,
      structure: "z2",
      warmup: "yes",
      sport: "cycling",
    },
    tempo_75: {
      name: `Tempo Builder 75 ${today}`,
      duration: 75,
      structure: "tempo",
      warmup: "yes",
      sport: "cycling",
    },
    sweetspot_90: {
      name: `Sweet Spot 90 ${today}`,
      duration: 90,
      structure: "sweetspot",
      warmup: "yes",
      sport: "cycling",
    },
  };

  const preset = presetMap[presetId];
  if (!preset) return;

  workoutNameInput.value = preset.name;
  workoutDurationInput.value = preset.duration;
  workoutStructureInput.value = preset.structure;
  workoutWarmupInput.value = preset.warmup;
  workoutSportInput.value = preset.sport;

  onBuildWorkout();
}

function onAutoPresetClick() {
  const entries = getSortedEntries();
  const latest = entries[entries.length - 1];
  const mode = autoPresetModeInput.value === "aggressive" ? "aggressive" : "conservative";
  if (!latest) {
    workoutStatus.textContent = "Geen check-in data: Auto Preset kiest standaard Z2 60.";
    onPresetClick("z2_60");
    return;
  }

  const status = computeStatus(latest);
  let selected = "z2_60";
  if (status.color === "red") {
    selected = "recovery";
  } else if (status.color === "orange") {
    selected = mode === "aggressive" ? "tempo_75" : "z2_60";
  } else {
    selected = mode === "aggressive" ? "sweetspot_90" : "tempo_75";
  }

  onPresetClick(selected);
  workoutStatus.textContent = `Auto Preset (${mode}) op basis van status ${status.color}: ${selected}.`;
}

function onDownloadWorkout() {
  if (!lastWorkoutBuild) {
    workoutStatus.textContent = "Genereer eerst een workout-bestand.";
    return;
  }
  downloadFile(lastWorkoutBuild.filename, lastWorkoutBuild.content, lastWorkoutBuild.mimeType);
}

function buildWorkoutSpec(durationMin, structure, warmup) {
  const map = {
    recovery: {
      mainIntensity: 0.58,
      intervals: [],
      label: "Herstel Z1",
    },
    z2: {
      mainIntensity: 0.72,
      intervals: [],
      label: "Duur Z2",
    },
    tempo: {
      mainIntensity: 0.7,
      intervals: [
        { workMin: 8, recoverMin: 4, repeat: 2, intensity: 0.84, recoverIntensity: 0.62 },
      ],
      label: "Tempo",
    },
    sweetspot: {
      mainIntensity: 0.68,
      intervals: [
        { workMin: 10, recoverMin: 5, repeat: 2, intensity: 0.9, recoverIntensity: 0.62 },
      ],
      label: "Sweet Spot",
    },
  };

  const picked = map[structure] || map.z2;
  const warmupMin = warmup ? 10 : 0;
  const cooldownMin = warmup ? 8 : 0;
  let remaining = Math.max(8, durationMin - warmupMin - cooldownMin);
  const steps = [];

  if (warmupMin > 0) {
    steps.push({ type: "warmup", min: warmupMin, from: 0.5, to: picked.mainIntensity });
  }

  if (!picked.intervals.length) {
    steps.push({ type: "steady", min: remaining, intensity: picked.mainIntensity });
  } else {
    for (const block of picked.intervals) {
      for (let i = 0; i < block.repeat; i += 1) {
        if (remaining <= 0) break;
        const work = Math.min(block.workMin, remaining);
        steps.push({ type: "work", min: work, intensity: block.intensity });
        remaining -= work;
        if (remaining <= 0) break;
        const recover = Math.min(block.recoverMin, remaining);
        steps.push({ type: "recover", min: recover, intensity: block.recoverIntensity });
        remaining -= recover;
      }
    }
    if (remaining > 0) {
      steps.push({ type: "steady", min: remaining, intensity: picked.mainIntensity });
    }
  }

  if (cooldownMin > 0) {
    steps.push({ type: "cooldown", min: cooldownMin, from: picked.mainIntensity, to: 0.48 });
  }

  return {
    durationMin,
    structureLabel: picked.label,
    steps,
  };
}

function buildGarminWorkout(name, sport, spec) {
  const steps = [];
  let order = 1;
  for (const s of spec.steps) {
    if (s.type === "warmup" || s.type === "cooldown") {
      steps.push({
        order: order++,
        type: s.type,
        durationSec: Math.round(s.min * 60),
        targetType: "power_pct",
        targetFrom: Math.round(s.from * 100),
        targetTo: Math.round(s.to * 100),
      });
      continue;
    }
    steps.push({
      order: order++,
      type: s.type,
      durationSec: Math.round(s.min * 60),
      targetType: "power_pct",
      targetValue: Math.round(s.intensity * 100),
    });
  }

  const payload = {
    formatVersion: 1,
    platform: "garmin-connect-template",
    workoutName: name,
    sport,
    totalDurationSec: Math.round(spec.durationMin * 60),
    workoutType: spec.structureLabel,
    steps,
  };

  const content = `${JSON.stringify(payload, null, 2)}\n`;
  return {
    filename: `${slugify(name)}-garmin.json`,
    content,
    preview: content,
    mimeType: "application/json",
  };
}

function buildZwoWorkout(name, sport, spec) {
  const zwoSport = "bike";
  const stepXml = spec.steps
    .map((s) => {
      if (s.type === "warmup") {
        return `<Warmup Duration=\"${Math.round(s.min * 60)}\" PowerLow=\"${fmt(s.from)}\" PowerHigh=\"${fmt(s.to)}\" />`;
      }
      if (s.type === "cooldown") {
        return `<Cooldown Duration=\"${Math.round(s.min * 60)}\" PowerLow=\"${fmt(s.to)}\" PowerHigh=\"${fmt(s.from)}\" />`;
      }
      return `<SteadyState Duration=\"${Math.round(s.min * 60)}\" Power=\"${fmt(s.intensity)}\" />`;
    })
    .join("\n      ");

  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<workout_file>\n  <author>Recovery &amp; Ride Coach</author>\n  <name>${xmlEscape(name)}</name>\n  <description>${xmlEscape(spec.structureLabel)} (${spec.durationMin} min)</description>\n  <sportType>${zwoSport}</sportType>\n  <workout>\n      ${stepXml}\n  </workout>\n</workout_file>\n`;

  return {
    filename: `${slugify(name)}.zwo`,
    content,
    preview: content,
    mimeType: "application/xml",
    normalizedSport: sport,
  };
}

function exportCsv() {
  const entries = getSortedEntries();
  if (!entries.length) return;
  const header = [
    "date",
    "sleep",
    "hrv",
    "rhr",
    "load",
    "weight",
    "fat",
    "neck",
    "scapula",
    "energy",
    "stress",
    "motivation",
    "gi",
    "notes",
    "status",
  ];

  const rows = entries.map((e) => {
    const status = computeStatus(e).label;
    return [
      e.date,
      e.metrics?.sleep ?? "",
      e.metrics?.hrv ?? "",
      e.metrics?.rhr ?? "",
      e.metrics?.load ?? "",
      e.metrics?.weight ?? "",
      e.metrics?.fat ?? "",
      e.subjective?.neck ?? "",
      e.subjective?.scapula ?? "",
      e.subjective?.energy ?? "",
      e.subjective?.stress ?? "",
      e.subjective?.motivation ?? "",
      e.subjective?.gi ?? "",
      (e.notes || "").replace(/,/g, " "),
      status,
    ].join(",");
  });

  downloadFile("recovery-ride-data.csv", [header.join(","), ...rows].join("\n"), "text/csv");
}

function printSummary() {
  const entries = getSortedEntries();
  const latest = entries[entries.length - 1];
  if (!latest) return;
  const status = computeStatus(latest);
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;

  popup.document.write(`
    <html>
      <head><title>Recovery & Ride summary</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1>Recovery & Ride Coach - Summary</h1>
        <p><strong>Date:</strong> ${latest.date}</p>
        <p><strong>Status:</strong> ${status.label} (score ${status.score})</p>
        <h2>Metrics</h2>
        <ul>
          <li>Slaap: ${latest.metrics?.sleep ?? "-"}</li>
          <li>HRV: ${latest.metrics?.hrv ?? "-"}</li>
          <li>Rusthartslag: ${latest.metrics?.rhr ?? "-"}</li>
          <li>Training load: ${latest.metrics?.load ?? "-"}</li>
          <li>Gewicht: ${latest.metrics?.weight ?? "-"}</li>
          <li>Vet%: ${latest.metrics?.fat ?? "-"}</li>
        </ul>
        <h2>Notities</h2>
        <p>${escapeHtml(latest.notes || "-")}</p>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayISO() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function num(v) {
  return Number.isFinite(v) ? v : 0;
}

function round(v, d) {
  return Number(v).toFixed(d);
}

function fmt(v) {
  return Number(v).toFixed(2);
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workout";
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
