import { getCheckin, saveCheckin } from "./db.js";
import { computeCheckinResult, getActiveReward, isNewMilestoneToday, getTierForStreak, formatLocalDate } from "./streak.js";
import { celebrate } from "./confetti.js";
import { App, refreshAll, showModal, hideModal } from "./app.js";

let els = {};

export function initHome() {
  els.btn = document.getElementById("checkin-btn");
  els.status = document.getElementById("checkin-status");
  els.currentStreak = document.getElementById("home-current-streak");
  els.longestStreak = document.getElementById("home-longest-streak");
  els.shiftInfo = document.getElementById("home-shift-info");
  els.rewardCard = document.getElementById("home-reward-card");
  els.canvas = document.getElementById("celebration-canvas");
  els.revealModal = document.getElementById("reveal-modal");
  els.revealImg = document.getElementById("reveal-img");
  els.revealPlaceholder = document.getElementById("reveal-placeholder");
  els.revealTitle = document.getElementById("reveal-title");
  els.revealSub = document.getElementById("reveal-sub");
  els.revealClose = document.getElementById("reveal-close");

  els.btn.addEventListener("click", handleCheckin);
  els.revealClose.addEventListener("click", () => hideModal(els.revealModal));
}

async function handleCheckin() {
  const today = formatLocalDate(new Date());
  const existing = await getCheckin(today);
  if (existing) return;

  const todayShift = App.shiftsByDate.get(today);
  if (!todayShift) return;

  const result = computeCheckinResult(new Date(), todayShift, App.settings.graceMinutes);
  await saveCheckin(result);
  await refreshAll();

  if (result.status === "late") {
    showLateFeedback();
    return;
  }

  celebrateOnTimeCheckin();
}

export function showLateFeedback() {
  els.revealImg.style.display = "none";
  els.revealPlaceholder.style.display = "flex";
  els.revealPlaceholder.textContent = "😌";
  els.revealTitle.textContent = "זה בסדר";
  els.revealSub.textContent = "האיחור הזה משפיע על הרצף שלך.";
  showModal(els.revealModal);
}

export function celebrateOnTimeCheckin() {
  const newStreak = App.currentStreak;
  const tier = getTierForStreak(newStreak);
  celebrate(els.canvas, tier, App.settings.soundEnabled);

  const milestone = isNewMilestoneToday(App.rewards, newStreak);
  if (milestone) {
    showMilestoneReveal(milestone, newStreak);
  }
}

function showMilestoneReveal(reward, streak) {
  if (reward.imageBase64) {
    els.revealImg.src = reward.imageBase64;
    els.revealImg.style.display = "block";
    els.revealPlaceholder.style.display = "none";
  } else {
    els.revealImg.style.display = "none";
    els.revealPlaceholder.style.display = "flex";
    els.revealPlaceholder.textContent = "🎉";
  }
  els.revealTitle.textContent = `רצף של ${streak} ימים!`;
  els.revealSub.textContent = `פתחת את ${reward.title}`;
  showModal(els.revealModal);
}

export function renderHome(app) {
  els.currentStreak.textContent = app.currentStreak;
  els.longestStreak.textContent = app.longestStreak;

  const today = formatLocalDate(new Date());
  const todayRecord = app.checkinsByDate.get(today);
  const todayShift = app.shiftsByDate.get(today);

  els.btn.classList.remove("late", "no-shift", "earned-star");
  if (todayRecord) {
    els.btn.disabled = true;
    if (todayRecord.status === "on-time") {
      els.btn.classList.add("earned-star");
      els.btn.textContent = "⭐ הגעת בזמן";
      els.status.textContent = `הגעת בשעה ${new Date(todayRecord.timestamp).toLocaleTimeString("he-IL", { hour: "numeric", minute: "2-digit" })}`;
    } else {
      els.btn.textContent = "נרשם";
      els.btn.classList.add("late");
      els.status.textContent = `איחור של ${todayRecord.minutesLate} דקות`;
    }
  } else if (todayShift) {
    els.btn.disabled = false;
    els.btn.textContent = "הגעתי לעבודה";
    els.status.textContent = "";
  } else {
    els.btn.disabled = true;
    els.btn.classList.add("no-shift");
    els.btn.textContent = "הגעתי לעבודה";
    els.status.textContent = "";
  }

  if (todayRecord) {
    els.shiftInfo.textContent = "";
  } else {
    els.shiftInfo.textContent = todayShift
      ? `משמרת היום מתחילה בשעה ${todayShift.startTime}`
      : "אין משמרת מתוכננת להיום";
  }

  const active = getActiveReward(app.rewards, app.currentStreak);
  if (active) {
    els.rewardCard.innerHTML = `
      <img src="${active.imageBase64 || ""}" alt="${escapeHtml(active.title)}" onerror="this.style.display='none'">
      <div>
        <div class="reward-title">${escapeHtml(active.title)}</div>
        <div class="reward-sub">נפתח ברצף של ${active.thresholdDays} ימים</div>
      </div>
    `;
  } else {
    els.rewardCard.innerHTML = `
      <div class="placeholder">🎵</div>
      <div>
        <div class="reward-title">עוד לא נפתח פרס</div>
        <div class="reward-sub">תמשיכי ברצף!</div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
