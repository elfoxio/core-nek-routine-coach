const DAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

const DEFAULT_PLAN = {
  maandag: { duration: "12-16 min", exercises: [] },
  dinsdag: { duration: "10-15 min", exercises: [] },
  woensdag: { duration: "8-12 min (herstel)", exercises: [] },
  donderdag: { duration: "12-16 min", exercises: [] },
  vrijdag: { duration: "10-14 min", exercises: [] },
  zaterdag: { duration: "optioneel 6-10 min", exercises: [] },
  zondag: { duration: "rustdag", exercises: [] },
};

const STORAGE_KEY = "routineCoach.v1";
const DATA_URL = "./data/routine.json";

const state = {
  selectedDay: localStorage.getItem("routineCoach.selectedDay") || "maandag",
  completed: loadCompleted(),
  plan: DEFAULT_PLAN,
};

const dayChips = document.getElementById("dayChips");
const routineTitle = document.getElementById("routineTitle");
const routineDuration = document.getElementById("routineDuration");
const exerciseList = document.getElementById("exerciseList");
const doneText = document.getElementById("doneText");
const barFill = document.getElementById("barFill");
const consistencyText = document.getElementById("consistencyText");

function makeFallbackId(day) {
  return `${day}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadCompleted() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveCompleted() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.completed));
}

function isDone(exerciseId) {
  const list = state.completed[state.selectedDay] || [];
  return list.includes(exerciseId);
}

function toggleExercise(exerciseId, checked) {
  const list = new Set(state.completed[state.selectedDay] || []);
  if (checked) list.add(exerciseId);
  else list.delete(exerciseId);
  state.completed[state.selectedDay] = Array.from(list);
  saveCompleted();
  renderProgress();
}

function sanitizePlan(rawPlan) {
  const sanitized = {};

  DAYS.forEach((day) => {
    const incomingDay = rawPlan?.[day] || {};
    const duration = typeof incomingDay.duration === "string" ? incomingDay.duration : DEFAULT_PLAN[day].duration;

    const incomingExercises = Array.isArray(incomingDay.exercises) ? incomingDay.exercises : [];
    const exercises = incomingExercises
      .filter((exercise) => exercise && typeof exercise === "object")
      .map((exercise) => ({
        id: typeof exercise.id === "string" && exercise.id.trim() ? exercise.id.trim() : makeFallbackId(day),
        name: typeof exercise.name === "string" ? exercise.name : "Nieuwe oefening",
        focus: typeof exercise.focus === "string" ? exercise.focus : "Algemeen",
        note: typeof exercise.note === "string" ? exercise.note : "",
        target: Boolean(exercise.target),
      }));

    sanitized[day] = { duration, exercises };
  });

  return sanitized;
}

async function loadPlan() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.plan = sanitizePlan(data);
  } catch (error) {
    console.error("Kon routine.json niet laden, fallback naar lege planning.", error);
    state.plan = DEFAULT_PLAN;
  }

  if (!state.plan[state.selectedDay]) {
    state.selectedDay = DAYS[0];
  }
}

function renderDayChips() {
  dayChips.innerHTML = "";
  DAYS.forEach((day) => {
    const btn = document.createElement("button");
    btn.className = `chip${state.selectedDay === day ? " active" : ""}`;
    btn.textContent = day;
    btn.type = "button";
    btn.addEventListener("click", () => {
      state.selectedDay = day;
      localStorage.setItem("routineCoach.selectedDay", day);
      render();
    });
    dayChips.appendChild(btn);
  });
}

function renderExercises() {
  const dayPlan = state.plan[state.selectedDay];
  routineTitle.textContent = `Routine voor ${state.selectedDay}`;
  routineDuration.textContent = `Duur: ${dayPlan.duration}`;

  exerciseList.innerHTML = "";
  dayPlan.exercises.forEach((exercise) => {
    const li = document.createElement("li");
    li.className = "exercise-item";

    const row = document.createElement("div");
    row.className = "exercise-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isDone(exercise.id);
    checkbox.addEventListener("change", (event) => {
      toggleExercise(exercise.id, event.target.checked);
    });

    const content = document.createElement("div");

    const label = document.createElement("p");
    label.className = "exercise-label";

    const focus = document.createElement("span");
    focus.className = "focus";
    focus.textContent = ` (${exercise.focus})`;

    label.textContent = exercise.name;
    label.appendChild(focus);

    if (!exercise.target) {
      const optional = document.createElement("span");
      optional.className = "optional";
      optional.textContent = "optioneel";
      label.appendChild(optional);
    }

    const note = document.createElement("p");
    note.className = "exercise-note";
    note.textContent = exercise.note;

    content.appendChild(label);
    content.appendChild(note);

    row.appendChild(checkbox);
    row.appendChild(content);
    li.appendChild(row);
    exerciseList.appendChild(li);
  });
}

function renderProgress() {
  const allTargetExercises = Object.values(state.plan)
    .flatMap((dayPlan) => dayPlan.exercises)
    .filter((exercise) => exercise.target)
    .map((exercise) => exercise.id);

  const uniqueTargets = new Set(allTargetExercises);
  let completedTargets = 0;

  Object.entries(state.plan).forEach(([day, dayPlan]) => {
    const doneSet = new Set(state.completed[day] || []);
    dayPlan.exercises.forEach((exercise) => {
      if (exercise.target && doneSet.has(exercise.id)) {
        completedTargets += 1;
      }
    });
  });

  const totalTargets = uniqueTargets.size;
  const progress = totalTargets ? Math.round((completedTargets / totalTargets) * 100) : 0;

  const trainingDays = DAYS.filter((day) => state.plan[day].exercises.some((exercise) => exercise.target));
  const daysHit = trainingDays.filter((day) => {
    const doneSet = new Set(state.completed[day] || []);
    return state.plan[day].exercises.some((exercise) => exercise.target && doneSet.has(exercise.id));
  }).length;
  const consistency = trainingDays.length ? Math.round((daysHit / trainingDays.length) * 100) : 0;

  doneText.textContent = `Afgerond deze week: ${completedTargets} / ${totalTargets}`;
  barFill.style.width = `${progress}%`;
  consistencyText.textContent = `${consistency}% consistentie`;
}

function render() {
  renderDayChips();
  renderExercises();
  renderProgress();
}

async function start() {
  await loadPlan();
  render();
}

start();
