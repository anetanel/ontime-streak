import { saveSettings, resetAllData } from "./db.js";
import { App, refreshAll, checkForUpdatesNow } from "./app.js";
import { exportBackup, readBackupFile, importBackup } from "./backup.js";
import { APP_VERSION } from "./version.js";
import { auth, signOutUser } from "./firebase-init.js";

let els = {};
let saveTimer = null;

export function initSettings() {
  els.accountPhoto = document.getElementById("account-photo");
  els.accountPhotoPlaceholder = document.getElementById("account-photo-placeholder");
  els.accountName = document.getElementById("account-name");
  els.accountEmail = document.getElementById("account-email");
  els.accountSignoutBtn = document.getElementById("account-signout-btn");
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
  els.checkUpdateBtn = document.getElementById("check-update-btn");
  els.checkUpdateStatus = document.getElementById("check-update-status");

  renderAccount();
  els.accountSignoutBtn.addEventListener("click", () => signOutUser());

  els.grace.addEventListener("change", debounceSaveSettings);
  els.sound.addEventListener("change", debounceSaveSettings);

  els.exportBtn.addEventListener("click", handleExport);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", handleImport);
  els.resetBtn.addEventListener("click", handleReset);
  els.checkUpdateBtn.addEventListener("click", handleCheckForUpdates);
}

async function handleCheckForUpdates() {
  els.checkUpdateStatus.textContent = "בודקת עדכון…";
  const registration = await checkForUpdatesNow();

  if (!registration) {
    els.checkUpdateStatus.textContent = "לא ניתן לבדוק עדכון כרגע.";
    return;
  }
  if (registration.installing || registration.waiting) {
    els.checkUpdateStatus.textContent = "נמצא עדכון — מתקינה, האפליקציה תיטען מחדש...";
    return;
  }
  els.checkUpdateStatus.textContent = `האפליקציה כבר מעודכנת (גרסה ${APP_VERSION}).`;
}

function renderAccount() {
  const user = auth.currentUser;
  if (!user) return;

  els.accountName.textContent = user.displayName || user.email || "";
  els.accountEmail.textContent = user.displayName ? user.email : "";

  if (user.photoURL) {
    els.accountPhoto.src = user.photoURL;
    els.accountPhoto.style.display = "block";
    els.accountPhotoPlaceholder.style.display = "none";
    els.accountPhoto.onerror = () => {
      els.accountPhoto.style.display = "none";
      els.accountPhotoPlaceholder.style.display = "flex";
    };
  } else {
    els.accountPhoto.style.display = "none";
    els.accountPhotoPlaceholder.style.display = "flex";
  }
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
