import { getSettings, getAllCheckins, getAllShifts, getAllPrizeAwards, saveStreakState, getStreakState } from "./db.js";
import { formatLocalDate, computeStreak, computeLongestStreak } from "./streak.js";
import { loadPrizeManifest } from "./prizes.js";
import { initHome, renderHome } from "./ui-home.js";
import { initHistory, renderHistory } from "./ui-history.js";
import { initPrizes, renderPrizes } from "./ui-prizes.js";
import { initSettings, renderSettings } from "./ui-settings.js";
import { initAuthGate } from "./auth-gate.js";
import { renderGuestView } from "./guest-view.js";
import "./devtools.js";

export const App = {
  settings: null,
  checkins: [],
  checkinsByDate: new Map(),
  shifts: [],
  shiftsByDate: new Map(),
  prizeAwards: [],
  prizeManifest: null,
  currentStreak: 0,
  longestStreak: 0,
};

export async function loadAll() {
  const [settings, checkins, shifts, prizeAwards, streakState] = await Promise.all([
    getSettings(),
    getAllCheckins(),
    getAllShifts(),
    getAllPrizeAwards(),
    getStreakState(),
  ]);

  App.settings = settings;
  App.checkins = checkins;
  App.checkinsByDate = new Map(checkins.map((c) => [c.date, c]));
  App.shifts = shifts;
  App.shiftsByDate = new Map(shifts.map((s) => [s.date, s]));
  App.prizeAwards = prizeAwards.sort((a, b) => (a.date < b.date ? 1 : -1));

  const now = new Date();
  const current = computeStreak(App.checkinsByDate, App.shiftsByDate, now);
  const longestComputed = computeLongestStreak(App.checkinsByDate, App.shiftsByDate, now);
  const longest = Math.max(streakState.longestStreak || 0, longestComputed, current);

  App.currentStreak = current;
  App.longestStreak = longest;

  await saveStreakState({
    currentStreak: current,
    longestStreak: longest,
    lastComputedForDate: formatLocalDate(now),
  });
}

export async function refreshAll() {
  await loadAll();
  renderHome(App);
  renderHistory(App);
  renderPrizes(App);
  renderSettings(App);
}

export function showModal(el) {
  el.classList.remove("hidden");
}

export function hideModal(el) {
  el.classList.add("hidden");
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tabbar button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
      document.getElementById(`screen-${btn.dataset.screen}`).classList.add("active");
      window.scrollTo(0, 0);
    });
  });
}

// iOS Safari can paint a position:fixed element at the post-scroll
// visual-viewport position while its hit-testing box stays at the
// stale layout-viewport position (e.g. while its dynamic toolbar is
// collapsing). Actively syncing the tab bar to visualViewport, per
// Apple's own recommended pattern for this, keeps both in agreement.
function pinTabbarToVisualViewport() {
  const tabbar = document.querySelector(".tabbar");
  if (!tabbar || !window.visualViewport) return;

  const update = () => {
    const vv = window.visualViewport;
    const layoutHeight = document.documentElement.clientHeight;
    const visualBottom = vv.offsetTop + vv.height;
    const delta = Math.max(0, layoutHeight - visualBottom);
    tabbar.style.transform = delta > 0.5 ? `translateY(-${delta}px)` : "";
  };

  window.visualViewport.addEventListener("resize", update);
  window.visualViewport.addEventListener("scroll", update);
  update();
}

let swRegistration = null;

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Without this, the browser can silently reuse an HTTP-cached copy of
  // sw.js itself when checking for updates, so a new deploy never gets
  // noticed. updateViaCache:"none" forces a real network check every time.
  window.addEventListener("load", async () => {
    try {
      swRegistration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      swRegistration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          swRegistration.update().catch(() => {});
        }
      });
    } catch (e) {
      // registration failed; app still works, just without offline support
    }
  });

  // Even once a new service worker is found and activates, the page
  // already open keeps running under the old one until it reloads.
  // Reload automatically the moment control switches over, so a fresh
  // launch (or the next time it's foregrounded) always shows the update.
  let refreshedAlready = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshedAlready) return;
    refreshedAlready = true;
    window.location.reload();
  });
}

// The Home Screen icon runs its own standalone WKWebView process on iOS,
// which can stay suspended across "closes" and isn't always as reliable
// as a Safari tab about checking for updates on its own. This gives a
// guaranteed manual way to force the check, used by the Settings button.
export async function checkForUpdatesNow() {
  if (!swRegistration) return null;
  try {
    await swRegistration.update();
  } catch (e) {
    // network unavailable or similar; still return the registration so
    // the caller can report whatever state is actually known
  }
  return swRegistration;
}

async function bootApp() {
  App.prizeManifest = await loadPrizeManifest();
  initHome();
  initHistory();
  initPrizes();
  initSettings();
  await refreshAll();
}

function boot() {
  setupTabs();
  pinTabbarToVisualViewport();
  registerServiceWorker();
  initAuthGate({ onAdmin: bootApp, onGuest: renderGuestView });
}

boot();
