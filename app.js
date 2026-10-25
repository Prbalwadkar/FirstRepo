const STORAGE_KEY = "worklog";

const $ = (id) => document.getElementById(id);
const dayPicker = $("day-picker");
const form = $("entry-form");
const taskInput = $("task-input");
const hoursInput = $("hours-input");
const minutesInput = $("minutes-input");
const submitBtn = $("submit-btn");
const cancelEdit = $("cancel-edit");
const formError = $("form-error");
const entryList = $("entry-list");
const empty = $("empty");
const dayTitle = $("day-title");
const dayTotal = $("day-total");
const historyList = $("history-list");
const grandTotal = $("grand-total");

// Each entry: { id, date: "YYYY-MM-DD", task, minutes }
let entries = load();
let selectedDate = todayISO();
let editingId = null;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (e.g. private mode); keep working in memory.
  }
}

function todayISO() {
  const d = new Date();
  return toISO(d);
}

function toISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDate(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatDay(iso, style = "long") {
  if (iso === todayISO()) return "Today";
  if (iso === shiftDate(todayISO(), -1)) return "Yesterday";
  return parseISO(iso).toLocaleDateString(undefined,
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function sum(list) {
  return list.reduce((total, e) => total + e.minutes, 0);
}

function render() {
  dayPicker.value = selectedDate;

  // Selected day
  const dayEntries = entries.filter((e) => e.date === selectedDate);
  dayTitle.textContent = formatDay(selectedDate);
  dayTotal.textContent = dayEntries.length ? formatDuration(sum(dayEntries)) : "";
  empty.hidden = dayEntries.length > 0;
  entryList.innerHTML = "";
  for (const entry of dayEntries) entryList.appendChild(renderEntry(entry));

  // History: one row per day, newest first
  const byDay = new Map();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date).push(e);
  }
  const days = [...byDay.keys()].sort().reverse();
  historyList.innerHTML = "";
  for (const date of days) {
    const list = byDay.get(date);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = date === selectedDate ? "selected" : "";

    const label = document.createElement("span");
    label.textContent = formatDay(date, "short");
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${list.length} ${list.length === 1 ? "entry" : "entries"}`;
    label.appendChild(count);

    const hours = document.createElement("span");
    hours.className = "hours";
    hours.textContent = formatDuration(sum(list));

    btn.append(label, hours);
    btn.addEventListener("click", () => selectDate(date));
    li.appendChild(btn);
    historyList.appendChild(li);
  }
  grandTotal.textContent = entries.length ? `${formatDuration(sum(entries))} total` : "";
}

function renderEntry(entry) {
  const li = document.createElement("li");
  li.className = "entry" + (entry.id === editingId ? " editing" : "");

  const task = document.createElement("span");
  task.className = "task";
  task.textContent = entry.task;

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = formatDuration(entry.minutes);

  const actions = document.createElement("div");
  actions.className = "actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => startEditing(entry));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete";
  del.textContent = "×";
  del.setAttribute("aria-label", "Delete");
  del.addEventListener("click", () => {
    entries = entries.filter((e) => e.id !== entry.id);
    if (editingId === entry.id) resetForm();
    save();
    render();
  });

  actions.append(edit, del);
  li.append(task, time, actions);
  return li;
}

function selectDate(iso) {
  if (!iso) return;
  selectedDate = iso;
  resetForm();
  render();
}

function startEditing(entry) {
  editingId = entry.id;
  taskInput.value = entry.task;
  hoursInput.value = Math.floor(entry.minutes / 60) || "";
  minutesInput.value = entry.minutes % 60 || "";
  submitBtn.textContent = "Save";
  cancelEdit.hidden = false;
  taskInput.focus();
  render();
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = "Add";
  cancelEdit.hidden = true;
  formError.hidden = true;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const task = taskInput.value.trim();
  const minutes = (parseInt(hoursInput.value, 10) || 0) * 60 + (parseInt(minutesInput.value, 10) || 0);

  if (!task) return;
  if (minutes <= 0) {
    formError.textContent = "Enter how long you spent on it.";
    formError.hidden = false;
    hoursInput.focus();
    return;
  }

  if (editingId) {
    const entry = entries.find((x) => x.id === editingId);
    if (entry) Object.assign(entry, { task, minutes });
  } else {
    entries.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      date: selectedDate,
      task,
      minutes,
    });
  }

  resetForm();
  save();
  render();
  taskInput.focus();
});

cancelEdit.addEventListener("click", () => {
  resetForm();
  render();
});

dayPicker.addEventListener("change", () => selectDate(dayPicker.value));
$("prev-day").addEventListener("click", () => selectDate(shiftDate(selectedDate, -1)));
$("next-day").addEventListener("click", () => selectDate(shiftDate(selectedDate, 1)));
$("today").addEventListener("click", () => selectDate(todayISO()));

render();
