import { saveSettings, resetAllData, DEFAULT_CALENDAR_KEYWORD } from "./db.js";
import { App, refreshAll, checkForUpdatesNow } from "./app.js";
import { exportBackup, readBackupFile, importBackup } from "./backup.js";
import { APP_VERSION, APP_BUILD_TIME } from "./version.js";
import { auth, signOutUser } from "./firebase-init.js";
import { pick, normalizeGender, applyGenderText } from "./gender.js";

let els = {};
let saveTimer = null;
let keywordStatusTimer = null;

export function initSettings() {
  els.accountPhoto = document.getElementById("account-photo");
  els.accountPhotoPlaceholder = document.getElementById("account-photo-placeholder");
  els.accountName = document.getElementById("account-name");
  els.accountEmail = document.getElementById("account-email");
  els.accountSignoutBtn = document.getElementById("account-signout-btn");
  els.sound = document.getElementById("set-sound");
  els.banner = document.getElementById("backup-banner");
  els.exportBtn = document.getElementById("export-btn");
  els.importBtn = document.getElementById("import-btn");
  els.importFile = document.getElementById("import-file");
  els.lastBackupLabel = document.getElementById("last-backup-label");
  els.resetBtn = document.getElementById("reset-btn");
  els.version = document.getElementById("app-version");
  els.version.textContent = `${APP_VERSION} · ${APP_BUILD_TIME}`;
  els.checkUpdateBtn = document.getElementById("check-update-btn");
  els.checkUpdateStatus = document.getElementById("check-update-status");

  renderAccount();
  els.accountSignoutBtn.addEventListener("click", () => signOutUser());

  els.sound.addEventListener("change", debounceSaveSettings);
  els.calendarKeyword = document.getElementById("set-calendar-keyword");
  els.calendarKeywordBtn = document.getElementById("set-calendar-keyword-btn");
  els.calendarKeywordLabel = document.getElementById("calendar-keyword-label");
  const savedKeyword = () => App.settings.calendarKeyword || DEFAULT_CALENDAR_KEYWORD;
  const updateKeywordBtn = () => {
    const v = els.calendarKeyword.value.trim() || DEFAULT_CALENDAR_KEYWORD;
    els.calendarKeywordBtn.disabled = v === savedKeyword();
  };
  els.calendarKeyword.addEventListener("input", updateKeywordBtn);
  els.calendarKeywordBtn.addEventListener("click", async () => {
    const calendarKeyword = els.calendarKeyword.value.trim() || DEFAULT_CALENDAR_KEYWORD;
    await saveSettings({ ...App.settings, calendarKeyword });
    await refreshAll();
    els.calendarKeyword.value = calendarKeyword;
    updateKeywordBtn();
    const status = document.getElementById("set-calendar-keyword-status");
    status.textContent = "✓ נשמר";
    clearTimeout(keywordStatusTimer);
    keywordStatusTimer = setTimeout(() => (status.textContent = ""), 2500);
  });
  els.genderToggle = document.getElementById("gender-toggle");
  els.genderToggle.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-gender]");
    if (!btn) return;
    await saveSettings({ ...App.settings, gender: btn.dataset.gender });
    await refreshAll();
  });

  els.exportBtn.addEventListener("click", handleExport);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", handleImport);
  els.resetBtn.addEventListener("click", handleReset);
  els.checkUpdateBtn.addEventListener("click", handleCheckForUpdates);

  initDeveloperMode();
}

// Hidden developer mode: 10 taps in a row on the account icon reveal a card
// with a button per window.__test helper. Taps more than 2s apart restart the count.
const DEV_KEY = "devMode";
const DEV_TAPS = 10;
const DEV_HINT_FROM = 4;
const DEV_TAP_GAP_MS = 2000;

let toastTimer = null;
export function showToast(text, ms = 1600) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => el.classList.remove("show"), ms); // ms 0: stays until replaced
}

function devModeOn() {
  try { return localStorage.getItem(DEV_KEY) === "1"; } catch { return false; }
}

function setDevMode(on) {
  try { on ? localStorage.setItem(DEV_KEY, "1") : localStorage.removeItem(DEV_KEY); } catch {}
  document.getElementById("dev-card").style.display = on ? "" : "none";
}

// Shows what iOS reports for the viewport, to debug the tab bar position.
function startViewportReadout() {
  const out = document.getElementById("dev-viewport");
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;height:100vh;width:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const safe = document.createElement("div");
  safe.style.cssText = "position:fixed;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden";
  document.body.appendChild(safe);
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return "-";
    const b = el.getBoundingClientRect();
    return `top ${Math.round(b.top)} bottom ${Math.round(b.bottom)}`;
  };
  const update = () => {
    const vv = window.visualViewport;
    out.textContent = [
      `innerHeight ${window.innerHeight}  clientHeight ${document.documentElement.clientHeight}`,
      `visualViewport h ${vv ? Math.round(vv.height) : "-"} top ${vv ? Math.round(vv.offsetTop) : "-"}`,
      `screen h ${screen.height}  100vh ${probe.offsetHeight}  safe-bottom ${parseFloat(getComputedStyle(safe).paddingBottom)}`,
      `standalone ${navigator.standalone === true}`,
      `#app ${r("#app")}`,
      `tabbar ${r(".tabbar")}`,
    ].join("\n");
  };
  ["resize", "orientationchange"].forEach((e) => window.addEventListener(e, update));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", update);
  document.querySelector('.tabbar [data-screen="settings"]').addEventListener("click", update);
  update();
}

function initDeveloperMode() {
  setDevMode(devModeOn());

  let taps = 0;
  let lastTap = 0;
  [els.accountPhoto, els.accountPhotoPlaceholder].forEach((icon) => {
    icon.style.touchAction = "manipulation"; // no double-tap zoom on rapid taps
    icon.addEventListener("click", () => {
      if (devModeOn()) return;
      const now = Date.now();
      taps = now - lastTap > DEV_TAP_GAP_MS ? 1 : taps + 1;
      lastTap = now;
      if (taps >= DEV_TAPS) {
        taps = 0;
        setDevMode(true);
        showToast("מצב מפתחים הופעל");
      } else if (taps >= DEV_HINT_FROM) {
        const left = DEV_TAPS - taps;
        showToast(`עוד ${left} לחיצות להפעלת מצב מפתחים`);
      }
    });
  });

  const n = document.getElementById("dev-n");
  const tier = document.getElementById("dev-tier");
  const destructive = { setStreak: "למחוק את כל הנתונים ולבנות רצף מדומה?", reset: "למחוק את כל הנתונים?" };
  document.getElementById("dev-card").addEventListener("click", async (e) => {
    const name = e.target.closest("[data-dev]")?.dataset.dev;
    if (!name) return;
    if (destructive[name] && !confirm(destructive[name])) return;
    const t = window.__test;
    const days = parseInt(n.value, 10);
    let label, run;
    switch (name) {
      case "previewCelebrationTier":
        label = `previewCelebration("${tier.value}")`;
        run = () => t.previewCelebration(tier.value);
        break;
      case "previewAllCelebrations":
      case "reset":
        label = `${name}()`;
        run = () => t[name]();
        break;
      default:
        label = `${name}(${days})`;
        run = () => t[name](days);
    }
    showToast(`${label} רץ…`, 0);
    try {
      await run();
      showToast(`${label} הסתיים`);
    } catch (err) {
      console.error(err);
      showToast(`${label} נכשל`, 3000);
    }
  });
  startViewportReadout();
  document.getElementById("dev-hide-btn").addEventListener("click", () => setDevMode(false));
}

async function handleCheckForUpdates() {
  els.checkUpdateStatus.textContent = pick(App.settings.gender, "בודק עדכון…", "בודקת עדכון…");
  const registration = await checkForUpdatesNow();

  if (!registration) {
    els.checkUpdateStatus.textContent = "לא ניתן לבדוק עדכון כרגע.";
    return;
  }
  if (registration.installing || registration.waiting) {
    els.checkUpdateStatus.textContent = pick(App.settings.gender, "נמצא עדכון — מתקין, האפליקציה תיטען מחדש...", "נמצא עדכון — מתקינה, האפליקציה תיטען מחדש...");
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
  els.sound.checked = app.settings.soundEnabled;
  const keyword = app.settings.calendarKeyword || DEFAULT_CALENDAR_KEYWORD;
  if (document.activeElement !== els.calendarKeyword) els.calendarKeyword.value = keyword;
  els.calendarKeywordLabel.textContent = keyword;
  els.calendarKeywordBtn.disabled = (els.calendarKeyword.value.trim() || DEFAULT_CALENDAR_KEYWORD) === keyword;
  const gender = normalizeGender(app.settings.gender);
  [...els.genderToggle.children].forEach((b) => b.classList.toggle("active", b.dataset.gender === gender));
  applyGenderText(document.getElementById("app"), gender);

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
    els.banner.textContent = pick(app.settings.gender, "גבה את הנתונים שלך כדי שלא לאבד את היסטוריית הרצף.", "גבי את הנתונים שלך כדי שלא לאבד את היסטוריית הרצף.");
  }
}
