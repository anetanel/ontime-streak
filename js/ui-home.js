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

  const result = computeCheckinResult(new Date(), App.settings);
  await saveCheckin(result);
  await refreshAll();

  if (result.isBonusDay) {
    showBonusFeedback();
    return;
  }

  if (result.status === "late") {
    showLateFeedback();
    return;
  }

  const newStreak = App.currentStreak;
  const tier = getTierForStreak(newStreak);
  celebrate(els.canvas, tier, App.settings.soundEnabled);

  const milestone = isNewMilestoneToday(App.rewards, newStreak);
  if (milestone) {
    showMilestoneReveal(milestone, newStreak);
  }
}

function showLateFeedback() {
  els.revealImg.style.display = "none";
  els.revealPlaceholder.style.display = "flex";
  els.revealPlaceholder.textContent = "😌";
  els.revealTitle.textContent = "That's okay";
  els.revealSub.textContent = "Today reset the streak — tomorrow's a fresh start.";
  showModal(els.revealModal);
}

function showBonusFeedback() {
  els.revealImg.style.display = "none";
  els.revealPlaceholder.style.display = "flex";
  els.revealPlaceholder.textContent = "👋";
  els.revealTitle.textContent = "Nice!";
  els.revealSub.textContent = "Not a scheduled work day — this check-in doesn't affect your streak.";
  showModal(els.revealModal);
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
  els.revealTitle.textContent = `${streak}-Day Streak!`;
  els.revealSub.textContent = `You unlocked ${reward.title}`;
  showModal(els.revealModal);
}

export function renderHome(app) {
  els.currentStreak.textContent = app.currentStreak;
  els.longestStreak.textContent = app.longestStreak;

  const today = formatLocalDate(new Date());
  const todayRecord = app.checkinsByDate.get(today);

  els.btn.classList.remove("late");
  if (todayRecord) {
    els.btn.disabled = true;
    if (todayRecord.isBonusDay) {
      els.btn.textContent = "Checked In ✓";
      els.status.textContent = "Bonus check-in — not a scheduled work day";
    } else if (todayRecord.status === "on-time") {
      els.btn.textContent = "Checked In ✓";
      els.status.textContent = `Arrived at ${new Date(todayRecord.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    } else {
      els.btn.textContent = "Checked In";
      els.btn.classList.add("late");
      els.status.textContent = `Late by ${todayRecord.minutesLate} min`;
    }
  } else {
    els.btn.disabled = false;
    els.btn.textContent = "I'm at Work";
    els.status.textContent = "";
  }

  const active = getActiveReward(app.rewards, app.currentStreak);
  if (active) {
    els.rewardCard.innerHTML = `
      <img src="${active.imageBase64 || ""}" alt="${escapeHtml(active.title)}" onerror="this.style.display='none'">
      <div>
        <div class="reward-title">${escapeHtml(active.title)}</div>
        <div class="reward-sub">Unlocked at ${active.thresholdDays}-day streak</div>
      </div>
    `;
  } else {
    els.rewardCard.innerHTML = `
      <div class="placeholder">🎵</div>
      <div>
        <div class="reward-title">No reward unlocked yet</div>
        <div class="reward-sub">Keep your streak going!</div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
