// One-time "add to Home Screen" card for guests: detects OS + browser and
// shows matching steps. Dismissal is remembered per device in localStorage.
import { pick } from "./gender.js";

const DISMISS_KEY = "installHintDismissed";

export function detectPlatform() {
  const ua = navigator.userAgent || "";
  const standalone =
    navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos) {
    let browser = "safari";
    if (/CriOS/.test(ua)) browser = "chrome";
    else if (/FxiOS/.test(ua)) browser = "firefox";
    else if (/EdgiOS/.test(ua)) browser = "edge";
    else if (/OPiOS|OPT\//.test(ua)) browser = "other";
    return { os: "ios", browser, standalone };
  }

  if (/Android/.test(ua)) {
    let browser = "other";
    if (/SamsungBrowser/.test(ua)) browser = "samsung";
    else if (/EdgA/.test(ua)) browser = "edge";
    else if (/Firefox/.test(ua)) browser = "firefox";
    else if (/Chrome/.test(ua) && !/OPR\//.test(ua)) browser = "chrome";
    return { os: "android", browser, standalone };
  }

  return { os: null, browser: "other", standalone };
}

const BROWSER_LABEL = {
  safari: "Safari",
  chrome: "Chrome",
  firefox: "Firefox",
  edge: "Edge",
  samsung: "Samsung Internet",
  other: "הדפדפן",
};

const SAFARI_NOTE = "לא רואים את האפשרות? פתחו את הקישור ב-Safari.";

function instructions(os, browser) {
  if (os === "ios") {
    switch (browser) {
      case "safari":
        return {
          steps: [
            "לחצו על כפתור השיתוף <b>⬆︎</b> בתחתית המסך",
            "גללו ובחרו <b>״הוסף למסך הבית״</b>",
            "לחצו <b>״הוסף״</b> בפינה העליונה",
          ],
        };
      case "firefox":
        return {
          steps: [
            "לחצו על תפריט <b>☰</b> בתחתית המסך",
            "בחרו <b>״שיתוף״</b> ואז <b>״הוסף למסך הבית״</b>",
            "לחצו <b>״הוסף״</b>",
          ],
          note: SAFARI_NOTE,
        };
      default:
        return {
          steps: [
            "לחצו על כפתור השיתוף <b>⬆︎</b> (ליד שורת הכתובת או בתפריט <b>⋯</b>)",
            "בחרו <b>״הוסף למסך הבית״</b>",
            "לחצו <b>״הוסף״</b>",
          ],
          note: SAFARI_NOTE,
        };
    }
  }

  if (os === "android") {
    switch (browser) {
      case "samsung":
        return {
          steps: [
            "לחצו על תפריט <b>☰</b> בתחתית המסך",
            "בחרו <b>״הוסף דף אל״</b> ואז <b>״מסך הבית״</b>",
            "אשרו בלחיצה על <b>״הוסף״</b>",
          ],
        };
      case "firefox":
        return {
          steps: [
            "לחצו על תפריט <b>⋮</b>",
            "בחרו <b>״התקנה״</b>",
            "אשרו בלחיצה על <b>״הוסף למסך הבית״</b>",
          ],
        };
      case "edge":
        return {
          steps: [
            "לחצו על תפריט <b>☰</b> בתחתית המסך",
            "בחרו <b>״הוסף למסך הבית״</b>",
            "אשרו בלחיצה על <b>״הוסף״</b>",
          ],
        };
      default:
        return {
          steps: [
            "לחצו על תפריט <b>⋮</b> בפינה העליונה",
            "בחרו <b>״התקנת אפליקציה״</b> (או <b>״הוספה למסך הבית״</b>)",
            "אשרו בלחיצה על <b>״התקנה״</b>",
          ],
        };
    }
  }

  return null;
}

function isDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

function rememberDismissed() {
  try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
}

export function initInstallHint(gender) {
  const card = document.getElementById("guest-install-card");
  if (!card || isDismissed()) return;

  const { os, browser, standalone } = detectPlatform();
  if (standalone) return;
  const info = instructions(os, browser);
  if (!info) return;

  const device = os === "ios" ? "באייפון" : "באנדרואיד";
  document.getElementById("guest-install-title").textContent =
    `${pick(gender, "הוסף", "הוסיפי")} את האפליקציה למסך הבית (${BROWSER_LABEL[browser]} ${device})`;
  document.getElementById("guest-install-steps").innerHTML =
    info.steps.map((s) => `<li>${s}</li>`).join("") +
    (info.note ? `<li class="install-note">${info.note}</li>` : "");

  document.getElementById("guest-install-dismiss").addEventListener("click", () => {
    rememberDismissed();
    card.style.display = "none";
  });
  card.style.display = "";
}
