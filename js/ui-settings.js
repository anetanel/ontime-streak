import { saveSettings, resetAllData } from "./db.js";
import { App, refreshAll } from "./app.js";
import { exportBackup, readBackupFile, importBackup } from "./backup.js";

const DOW = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

let els = {};
let saveTimer = null;

export function initSettings() {
  els.startTime = document.getElementById("set-start-time");
  els.grace = document.getElementById("set-grace");
  els.scheduleToggles = document.getElementById("schedule-toggles");
  els.sound = document.getElementById("set-sound");
  els.banner = document.getElementById("backup-banner");
  els.exportBtn = document.getElementById("export-btn");
  els.importBtn = document.getElementById("import-btn");
  els.importFile = document.getElementById("import-file");
  els.lastBackupLabel = document.getElementById("last-backup-label");
  els.resetBtn = document.getElementById("reset-btn");

  els.scheduleToggles.innerHTML = DOW.map(
    (d) => `
    <div class="row-toggle">
      <span>${d.label}</span>
      <label class="switch">
        <input type="checkbox" data-dow="${d.key}">
        <span class="track"></span>
        <span class="thumb"></span>
      </label>
    </div>
  `
  ).join("");

  els.startTime.addEventListener("change", debounceSaveSettings);
  els.grace.addEventListener("change", debounceSaveSettings);
  els.sound.addEventListener("change", debounceSaveSettings);
  els.scheduleToggles.querySelectorAll("input[data-dow]").forEach((input) => {
    input.addEventListener("change", debounceSaveSettings);
  });

  els.exportBtn.addEventListener("click", handleExport);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", handleImport);
  els.resetBtn.addEventListener("click", handleReset);
}

function debounceSaveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commitSettings, 150);
}

async function commitSettings() {
  const weeklySchedule = {};
  els.scheduleToggles.querySelectorAll("input[data-dow]").forEach((input) => {
    weeklySchedule[input.dataset.dow] = input.checked;
  });

  const settings = {
    ...App.settings,
    expectedStartTime: els.startTime.value || App.settings.expectedStartTime,
    graceMinutes: parseInt(els.grace.value, 10) || 0,
    soundEnabled: els.sound.checked,
    weeklySchedule,
  };

  await saveSettings(settings);
  await refreshAll();
}

async function handleExport() {
  try {
    await exportBackup();
    await refreshAll();
  } catch (e) {
    alert("Couldn't export backup: " + e.message);
  }
}

async function handleImport(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = await readBackupFile(file);
    if (!confirm("Importing will replace all current check-ins and rewards with the backup file. Continue?")) return;
    await importBackup(data);
    await refreshAll();
    alert("Backup imported.");
  } catch (err) {
    alert(err.message);
  }
}

async function handleReset() {
  if (!confirm("This will permanently delete all check-ins, streaks, and rewards on this device. Are you sure?")) return;
  if (!confirm("Really reset everything? This can't be undone.")) return;
  await resetAllData();
  await refreshAll();
}

export function renderSettings(app) {
  els.startTime.value = app.settings.expectedStartTime;
  els.grace.value = app.settings.graceMinutes;
  els.sound.checked = app.settings.soundEnabled;

  els.scheduleToggles.querySelectorAll("input[data-dow]").forEach((input) => {
    input.checked = !!app.settings.weeklySchedule[input.dataset.dow];
  });

  if (app.settings.lastBackupAt) {
    const d = new Date(app.settings.lastBackupAt);
    els.lastBackupLabel.textContent = `Last backup: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    const daysSince = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      els.banner.style.display = "block";
      els.banner.textContent = "It's been a while — consider backing up your streak history.";
    } else {
      els.banner.style.display = "none";
    }
  } else {
    els.lastBackupLabel.textContent = "No backup taken yet";
    els.banner.style.display = "block";
    els.banner.textContent = "Back up your data so you never lose your streak history.";
  }
}
