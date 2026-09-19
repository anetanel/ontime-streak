import { saveSettings, resetAllData } from "./db.js";
import { App, refreshAll } from "./app.js";
import { exportBackup, readBackupFile, importBackup } from "./backup.js";

const DOW = [
  { key: "sun", label: "ראשון" },
  { key: "mon", label: "שני" },
  { key: "tue", label: "שלישי" },
  { key: "wed", label: "רביעי" },
  { key: "thu", label: "חמישי" },
  { key: "fri", label: "שישי" },
  { key: "sat", label: "שבת" },
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
    alert("ייצוא הגיבוי נכשל: " + e.message);
  }
}

async function handleImport(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = await readBackupFile(file);
    if (!confirm("ייבוא יחליף את כל הצ'ק-אינים והפרסים הנוכחיים בקובץ הגיבוי. להמשיך?")) return;
    await importBackup(data);
    await refreshAll();
    alert("הגיבוי יובא בהצלחה.");
  } catch (err) {
    alert(err.message);
  }
}

async function handleReset() {
  if (!confirm("פעולה זו תמחק לצמיתות את כל הצ'ק-אינים, הרצפים והפרסים במכשיר. להמשיך?")) return;
  if (!confirm("לאפס את הכל? הפעולה בלתי הפיכה.")) return;
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
    els.lastBackupLabel.textContent = `גיבוי אחרון: ${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "numeric", minute: "2-digit" })}`;
    const daysSince = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      els.banner.style.display = "block";
      els.banner.textContent = "עבר די הרבה זמן — כדאי לגבות את היסטוריית הרצף שלך.";
    } else {
      els.banner.style.display = "none";
    }
  } else {
    els.lastBackupLabel.textContent = "עדיין לא בוצע גיבוי";
    els.banner.style.display = "block";
    els.banner.textContent = "גבי את הנתונים שלך כדי שלא לאבד את היסטוריית הרצף.";
  }
}
