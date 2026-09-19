import { getSettings, getAllCheckins, getAllRewards, getAllShifts, saveStreakState, getStreakState } from "./db.js";
import { formatLocalDate, computeStreak, computeLongestStreak } from "./streak.js";
import { initHome, renderHome } from "./ui-home.js";
import { initHistory, renderHistory } from "./ui-history.js";
import { initRewards, renderRewards } from "./ui-rewards.js";
import { initSettings, renderSettings } from "./ui-settings.js";

export const App = {
  settings: null,
  checkins: [],
  checkinsByDate: new Map(),
  rewards: [],
  shifts: [],
  shiftsByDate: new Map(),
  currentStreak: 0,
  longestStreak: 0,
};

export async function loadAll() {
  const [settings, checkins, rewards, shifts, streakState] = await Promise.all([
    getSettings(),
    getAllCheckins(),
    getAllRewards(),
    getAllShifts(),
    getStreakState(),
  ]);

  App.settings = settings;
  App.checkins = checkins;
  App.checkinsByDate = new Map(checkins.map((c) => [c.date, c]));
  App.rewards = rewards;
  App.shifts = shifts;
  App.shiftsByDate = new Map(shifts.map((s) => [s.date, s]));

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
  renderRewards(App);
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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Without this, the browser can silently reuse an HTTP-cached copy of
  // sw.js itself when checking for updates, so a new deploy never gets
  // noticed. updateViaCache:"none" forces a real network check every time.
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
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

async function boot() {
  setupTabs();
  pinTabbarToVisualViewport();
  registerServiceWorker();
  initHome();
  initHistory();
  initRewards();
  initSettings();
  await refreshAll();
}

boot();
