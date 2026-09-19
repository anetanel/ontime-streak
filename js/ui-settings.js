import { saveSettings, resetAllData } from "./db.js";
import { App, refreshAll } from "./app.js";
import { exportBackup, readBackupFile, importBackup } from "./backup.js";
import { APP_VERSION } from "./version.js";

let els = {};
let saveTimer = null;

export function initSettings() {
  els.grace = document.getElementById("set-grace");
  els.sound = document.getElementById("set-sound");
  els.banner = document.getElementById("backup-banner");
  els.exportBtn = document.getElementById("export-btn");
  els.importBtn = document.getElementById("import-btn");
  els.importFile = document.getElementById("import-file");
  els.lastBackupLabel = document.getElementById("last-backup-label");
  els.resetBtn = document.getElementById("reset-btn");
  els.version = document.getElementById("app-version");
  els.version.textContent = APP_VERSION;

  els.grace.addEventListener("change", debounceSaveSettings);
  els.sound.addEventListener("change", debounceSaveSettings);

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
  const settings = {
    ...App.settings,
    graceMinutes: parseInt(els.grace.value, 10) || 0,
    soundEnabled: els.sound.checked,
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
  els.grace.value = app.settings.graceMinutes;
  els.sound.checked = app.settings.soundEnabled;

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
