const STORAGE_KEY = "solarMonitor.torhout.v1";
const SUNNY_MONTHS_KEY = "solarMonitor.torhout.sunnyMonths.v1";

const MONTHS_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

const TORHOUT_SUGGESTED_SUNNY_MONTHS = new Set([3, 4, 5, 6, 7]);

const form = document.getElementById("dailyForm");
const bulkInput = document.getElementById("bulkInput");
const importBtn = document.getElementById("importBtn");
const importFeedback = document.getElementById("importFeedback");
const dataRows = document.getElementById("dataRows");
const stats = document.getElementById("stats");
const chart = document.getElementById("chart");
const rangeSelect = document.getElementById("rangeSelect");
const clearBtn = document.getElementById("clearBtn");
const monthTags = document.getElementById("monthTags");

const state = {
  entries: loadEntries(),
  sunnyMonths: loadSunnyMonths(),
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((entry) => entry && typeof entry === "object" && typeof entry.date === "string")
      .map((entry) => normalizeEntry(entry))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function loadSunnyMonths() {
  try {
    const raw = JSON.parse(localStorage.getItem(SUNNY_MONTHS_KEY) || "[]");
    if (!Array.isArray(raw)) return new Set(TORHOUT_SUGGESTED_SUNNY_MONTHS);
    return new Set(raw.filter((monthIndex) => Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11));
  } catch {
    return new Set(TORHOUT_SUGGESTED_SUNNY_MONTHS);
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function saveSunnyMonths() {
  localStorage.setItem(SUNNY_MONTHS_KEY, JSON.stringify(Array.from(state.sunnyMonths)));
}

function normalizeEntry(entry) {
  return {
    date: entry.date,
    gridImport: toNumber(entry.gridImport),
    gridExport: toNumber(entry.gridExport),
    solarProduction: toNumber(entry.solarProduction),
    batteryCharge: toNumber(entry.batteryCharge),
    batteryDischarge: toNumber(entry.batteryDischarge),
  };
}

function upsertEntry(entry) {
  const normalized = normalizeEntry(entry);
  const index = state.entries.findIndex((item) => item.date === normalized.date);
  if (index >= 0) state.entries[index] = normalized;
  else state.entries.push(normalized);
  state.entries.sort((a, b) => a.date.localeCompare(b.date));
  saveEntries();
}

function formatKwh(value) {
  return `${value.toFixed(2)} kWh`;
}

function parseBulkRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((part) => part.trim()));
}

function getVisibleEntries() {
  if (rangeSelect.value === "all") return [...state.entries];

  const days = Number(rangeSelect.value);
  if (!Number.isFinite(days)) return [...state.entries];

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days + 1);

  return state.entries.filter((entry) => new Date(`${entry.date}T00:00:00`) >= cutoff);
}

function renderStats() {
  const visibleEntries = getVisibleEntries();

  const totals = visibleEntries.reduce(
    (acc, entry) => {
      acc.gridImport += entry.gridImport;
      acc.gridExport += entry.gridExport;
      acc.solarProduction += entry.solarProduction;
      acc.batteryCharge += entry.batteryCharge;
      acc.batteryDischarge += entry.batteryDischarge;
      return acc;
    },
    {
      gridImport: 0,
      gridExport: 0,
      solarProduction: 0,
      batteryCharge: 0,
      batteryDischarge: 0,
    },
  );

  const householdUseEstimate = totals.gridImport + totals.solarProduction + totals.batteryDischarge - totals.gridExport - totals.batteryCharge;
  const netGrid = totals.gridImport - totals.gridExport;
  const batteryNet = totals.batteryDischarge - totals.batteryCharge;

  const lines = [
    ["Dagen in periode", String(visibleEntries.length)],
    ["Totaal afname", formatKwh(totals.gridImport)],
    ["Totaal injectie", formatKwh(totals.gridExport)],
    ["Totaal productie", formatKwh(totals.solarProduction)],
    ["Netto van net", formatKwh(netGrid)],
    ["Netto batterij", formatKwh(batteryNet)],
    ["Geschat verbruik woning", formatKwh(householdUseEstimate)],
  ];

  stats.innerHTML = lines
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

function renderTable() {
  dataRows.innerHTML = "";
  const visibleEntries = getVisibleEntries();

  visibleEntries.forEach((entry) => {
    const tr = document.createElement("tr");
    const batteryNet = entry.batteryDischarge - entry.batteryCharge;

    tr.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.gridImport.toFixed(2)}</td>
      <td>${entry.gridExport.toFixed(2)}</td>
      <td>${entry.solarProduction.toFixed(2)}</td>
      <td>${entry.batteryCharge.toFixed(2)}</td>
      <td>${entry.batteryDischarge.toFixed(2)}</td>
      <td>${batteryNet.toFixed(2)}</td>
    `;
    dataRows.appendChild(tr);
  });
}

function makeSeries(entries, key) {
  return entries.map((entry) => {
    if (key === "batteryNet") return entry.batteryDischarge - entry.batteryCharge;
    return entry[key];
  });
}

function yForValue(value, minY, maxY, height, padding) {
  const innerH = height - padding.top - padding.bottom;
  const range = maxY - minY || 1;
  return padding.top + innerH - ((value - minY) / range) * innerH;
}

function drawLineSeries(ctx, values, minY, maxY, color, width, height, padding) {
  if (!values.length) return;

  const innerW = width - padding.left - padding.right;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  ctx.beginPath();
  values.forEach((value, index) => {
    const x = padding.left + index * step;
    const y = yForValue(value, minY, maxY, height, padding);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawAxes(ctx, width, height, padding, minY, maxY) {
  ctx.strokeStyle = "#5e6d7d";
  ctx.lineWidth = 1;
  const xAxisY = yForValue(0, minY, maxY, height, padding);

  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.moveTo(padding.left, xAxisY);
  ctx.lineTo(width - padding.right, xAxisY);
  ctx.stroke();
}

function drawGrid(ctx, width, height, padding, minY, maxY) {
  const lines = 4;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  ctx.font = "12px system-ui";
  ctx.fillStyle = "#3f4b57";

  for (let i = 0; i <= lines; i += 1) {
    const y = padding.top + (innerH / lines) * i;
    const value = maxY - ((maxY - minY) * i) / lines;

    ctx.strokeStyle = "rgba(40, 52, 64, 0.15)";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + innerW, y);
    ctx.stroke();

    ctx.fillText(value.toFixed(1), 12, y + 4);
  }
}

function drawLabels(ctx, entries, width, height, padding) {
  if (!entries.length) return;

  const innerW = width - padding.left - padding.right;
  const baseY = height - 14;

  const ticks = Math.min(6, entries.length);

  ctx.font = "12px system-ui";
  ctx.fillStyle = "#30404f";

  for (let i = 0; i < ticks; i += 1) {
    const ratio = ticks === 1 ? 0 : i / (ticks - 1);
    const index = Math.round(ratio * (entries.length - 1));
    const x = padding.left + ratio * innerW;

    const [year, month, day] = entries[index].date.split("-");
    const label = `${day}/${month}`;

    ctx.fillText(label, x - 18, baseY);

    if (i === ticks - 1) {
      ctx.fillText(year, width - 52, baseY);
    }
  }
}

function renderChart() {
  const entries = getVisibleEntries();
  const ctx = chart.getContext("2d");
  const width = chart.width;
  const height = chart.height;
  const padding = { top: 20, right: 16, bottom: 40, left: 54 };

  ctx.clearRect(0, 0, width, height);

  if (!entries.length) {
    ctx.font = "16px system-ui";
    ctx.fillStyle = "#364552";
    ctx.fillText("Nog geen data. Voeg een eerste dag toe.", 50, 60);
    return;
  }

  const importSeries = makeSeries(entries, "gridImport");
  const exportSeries = makeSeries(entries, "gridExport");
  const solarSeries = makeSeries(entries, "solarProduction");
  const batterySeries = makeSeries(entries, "batteryNet");

  const maxValue = Math.max(1, ...importSeries, ...exportSeries, ...solarSeries, ...batterySeries);
  const minValue = Math.min(0, ...batterySeries);

  drawGrid(ctx, width, height, padding, minValue, maxValue);
  drawAxes(ctx, width, height, padding, minValue, maxValue);

  drawLineSeries(ctx, importSeries, minValue, maxValue, "#bd4f4f", width, height, padding);
  drawLineSeries(ctx, exportSeries, minValue, maxValue, "#3c7bb8", width, height, padding);
  drawLineSeries(ctx, solarSeries, minValue, maxValue, "#db9f1f", width, height, padding);
  drawLineSeries(ctx, batterySeries, minValue, maxValue, "#25745f", width, height, padding);

  drawLabels(ctx, entries, width, height, padding);
}

function renderSunnyMonths() {
  monthTags.innerHTML = "";

  MONTHS_NL.forEach((monthName, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-tag${state.sunnyMonths.has(index) ? " active" : ""}`;
    button.textContent = monthName;
    button.addEventListener("click", () => {
      if (state.sunnyMonths.has(index)) state.sunnyMonths.delete(index);
      else state.sunnyMonths.add(index);
      saveSunnyMonths();
      renderSunnyMonths();
    });
    monthTags.appendChild(button);
  });
}

function renderAll() {
  renderStats();
  renderTable();
  renderChart();
  renderSunnyMonths();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const entry = {
    date: String(formData.get("date")),
    gridImport: toNumber(formData.get("gridImport")),
    gridExport: toNumber(formData.get("gridExport")),
    solarProduction: toNumber(formData.get("solarProduction")),
    batteryCharge: toNumber(formData.get("batteryCharge")),
    batteryDischarge: toNumber(formData.get("batteryDischarge")),
  };

  if (!entry.date) return;

  upsertEntry(entry);
  importFeedback.textContent = `Opgeslagen voor ${entry.date}.`;
  renderAll();
});

importBtn.addEventListener("click", () => {
  const rows = parseBulkRows(bulkInput.value);

  if (!rows.length) {
    importFeedback.textContent = "Geen lijnen gevonden om te importeren.";
    return;
  }

  let ok = 0;
  let skipped = 0;

  rows.forEach((parts) => {
    if (parts.length < 6 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
      skipped += 1;
      return;
    }

    const entry = {
      date: parts[0],
      gridImport: toNumber(parts[1]),
      gridExport: toNumber(parts[2]),
      solarProduction: toNumber(parts[3]),
      batteryCharge: toNumber(parts[4]),
      batteryDischarge: toNumber(parts[5]),
    };

    upsertEntry(entry);
    ok += 1;
  });

  importFeedback.textContent = `Import klaar: ${ok} toegevoegd/bijgewerkt, ${skipped} overgeslagen.`;
  renderAll();
});

rangeSelect.addEventListener("change", () => {
  renderAll();
});

clearBtn.addEventListener("click", () => {
  const confirmed = window.confirm("Wil je echt alle opgeslagen data wissen?");
  if (!confirmed) return;

  state.entries = [];
  saveEntries();
  renderAll();
  importFeedback.textContent = "Alle data gewist.";
});

(function init() {
  document.getElementById("date").value = todayIso();
  renderAll();
})();
