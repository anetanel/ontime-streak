import { getSettings, getAllCheckins, getAllRewards, getAllShifts, saveStreakState, getStreakState } from "./db.js";
import { formatLocalDate, computeStreak, computeLongestStreak } from "./streak.js";
import { initHome, renderHome } from "./ui-home.js";
import { initHistory, renderHistory } from "./ui-history.js";
import { initRewards, renderRewards } from "./ui-rewards.js";
import { initShifts, renderShifts } from "./ui-shifts.js";
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
  renderShifts(App);
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
    });
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

async function boot() {
  setupTabs();
  registerServiceWorker();
  initHome();
  initHistory();
  initRewards();
  initShifts();
  initSettings();
  await refreshAll();
}

boot();
