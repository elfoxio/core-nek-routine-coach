const DAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

const PLAN = {
  maandag: {
    duration: "12-16 min",
    exercises: [
      {
        id: "ma-plank",
        name: "Dead Bug (rustig)",
        focus: "Core",
        note: "2 sets x 6-8/zijde. Onderrug neutraal, uitademen bij uitstrekken.",
        target: true,
      },
      {
        id: "ma-chin-tuck",
        name: "Chin Tuck liggend",
        focus: "Nek",
        note: "2 sets x 8 herhalingen, 3 sec vasthouden. Geen pijn of tintelingen.",
        target: true,
      },
      {
        id: "ma-wall-slide",
        name: "Wall Slide + Serratus reach",
        focus: "Trapezium/Schouderblad",
        note: "2 sets x 8. Schouders laag, nek lang.",
        target: true,
      },
    ],
  },
  dinsdag: {
    duration: "10-15 min",
    exercises: [
      {
        id: "di-side-plank",
        name: "Side Plank (knieën)",
        focus: "Core",
        note: "2 sets x 20-30 sec/zijde. Heup recht, adem rustig.",
        target: true,
      },
      {
        id: "di-isometric",
        name: "Nek-isometrie met hand",
        focus: "Nek",
        note: "Voor/zijwaarts, lichte druk. 2 sets x 5 herhalingen van 5 sec.",
        target: true,
      },
      {
        id: "di-band-row",
        name: "Band Row (lichte weerstand)",
        focus: "Middenrug/Trapezium",
        note: "2 sets x 10-12. Schouderbladen zacht naar achter/beneden.",
        target: true,
      },
    ],
  },
  woensdag: {
    duration: "8-12 min (herstel)",
    exercises: [
      {
        id: "wo-breath",
        name: "90/90 ademhaling",
        focus: "Herstel",
        note: "5 rustige ademcycli, focus op ribbeweging en ontspanning.",
        target: false,
      },
      {
        id: "wo-openbook",
        name: "Open Book thoracaal (klein bereik)",
        focus: "Mobiliteit",
        note: "1-2 sets x 6/zijde. Nek neutraal, rotatie uit de bovenrug.",
        target: false,
      },
    ],
  },
  donderdag: {
    duration: "12-16 min",
    exercises: [
      {
        id: "do-bird-dog",
        name: "Bird Dog (korte hefboom)",
        focus: "Core",
        note: "2 sets x 6/zijde, 2 sec hold. Bekken stabiel.",
        target: true,
      },
      {
        id: "do-chin-tuck-wall",
        name: "Chin Tuck tegen muur",
        focus: "Nek",
        note: "2 sets x 8. Achterhoofd licht tegen muur, geen forceren.",
        target: true,
      },
      {
        id: "do-lower-trap",
        name: "Prone Y (duimen omhoog)",
        focus: "Lage trapezius",
        note: "2 sets x 8, zeer lichte belasting of zonder gewicht.",
        target: true,
      },
    ],
  },
  vrijdag: {
    duration: "10-14 min",
    exercises: [
      {
        id: "vr-pallof",
        name: "Pallof Press (licht)",
        focus: "Core anti-rotatie",
        note: "2 sets x 8/zijde. Romp stil, nek neutraal.",
        target: true,
      },
      {
        id: "vr-scap-set",
        name: "Scapula setting + shrug release",
        focus: "Nek/Trapezium",
        note: "2 sets x 8 trage herhalingen. Span los, niet optrekken.",
        target: true,
      },
      {
        id: "vr-face-pull",
        name: "Face Pull licht",
        focus: "Achterste schouder/Trapezium",
        note: "2 sets x 10. Ellebogen lager dan schouders, geen nekextensie.",
        target: true,
      },
    ],
  },
  zaterdag: {
    duration: "optioneel 6-10 min",
    exercises: [
      {
        id: "za-walk",
        name: "Wandeling + nekontspanning",
        focus: "Herstel",
        note: "10-20 min wandelen, schouders ontspannen, rustige ademhaling.",
        target: false,
      },
    ],
  },
  zondag: {
    duration: "rustdag",
    exercises: [
      {
        id: "zo-checkin",
        name: "Weekcheck houding op fiets",
        focus: "Planning",
        note: "Controleer zadel/stuurhoogte en nekcomfort voor komende week.",
        target: false,
      },
    ],
  },
};

const STORAGE_KEY = "routineCoach.v1";

const state = {
  selectedDay: localStorage.getItem("routineCoach.selectedDay") || "maandag",
  completed: loadCompleted(),
};

const dayChips = document.getElementById("dayChips");
const routineTitle = document.getElementById("routineTitle");
const routineDuration = document.getElementById("routineDuration");
const exerciseList = document.getElementById("exerciseList");
const doneText = document.getElementById("doneText");
const barFill = document.getElementById("barFill");
const consistencyText = document.getElementById("consistencyText");

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
  const dayPlan = PLAN[state.selectedDay];
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
  const allTargetExercises = Object.values(PLAN)
    .flatMap((dayPlan) => dayPlan.exercises)
    .filter((exercise) => exercise.target)
    .map((exercise) => exercise.id);

  const uniqueTargets = new Set(allTargetExercises);
  let completedTargets = 0;

  Object.entries(PLAN).forEach(([day, dayPlan]) => {
    const doneSet = new Set(state.completed[day] || []);
    dayPlan.exercises.forEach((exercise) => {
      if (exercise.target && doneSet.has(exercise.id)) {
        completedTargets += 1;
      }
    });
  });

  const totalTargets = uniqueTargets.size;
  const progress = totalTargets ? Math.round((completedTargets / totalTargets) * 100) : 0;

  const trainingDays = ["maandag", "dinsdag", "donderdag", "vrijdag"];
  const daysHit = trainingDays.filter((day) => {
    const doneSet = new Set(state.completed[day] || []);
    return PLAN[day].exercises.some((exercise) => exercise.target && doneSet.has(exercise.id));
  }).length;
  const consistency = Math.round((daysHit / trainingDays.length) * 100);

  doneText.textContent = `Afgerond deze week: ${completedTargets} / ${totalTargets}`;
  barFill.style.width = `${progress}%`;
  consistencyText.textContent = `${consistency}% consistentie`;
}

function render() {
  renderDayChips();
  renderExercises();
  renderProgress();
}

render();
