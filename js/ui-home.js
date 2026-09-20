import { getCheckin, saveCheckin } from "./db.js";
import {
  computeCheckinResult,
  getTierForStreak,
  formatLocalDate,
  parseLocalDate,
  snapToTimeOptions,
  isLateExemptionAvailable,
} from "./streak.js";
import { celebrate } from "./confetti.js";
import { evaluateAndAwardPrize, getTierByKey, daysUntilNextPrize } from "./prizes.js";
import { App, refreshAll, showModal, hideModal } from "./app.js";

let els = {};
let reasonResolve = null;
let checkinEditingDate = null;

export function initHome() {
  els.btn = document.getElementById("checkin-btn");
  els.status = document.getElementById("checkin-status");
  els.currentStreak = document.getElementById("home-current-streak");
  els.longestStreak = document.getElementById("home-longest-streak");
  els.shiftInfo = document.getElementById("home-shift-info");
  els.rewardCard = document.getElementById("home-reward-card");
  els.nextPrize = document.getElementById("home-next-prize");
  els.canvas = document.getElementById("celebration-canvas");
  els.revealModal = document.getElementById("reveal-modal");
  els.revealImg = document.getElementById("reveal-img");
  els.revealPlaceholder = document.getElementById("reveal-placeholder");
  els.revealTitle = document.getElementById("reveal-title");
  els.revealSub = document.getElementById("reveal-sub");
  els.revealClose = document.getElementById("reveal-close");

  els.reasonModal = document.getElementById("late-reason-modal");
  els.reasonNote = document.getElementById("late-reason-note");
  els.reasonHabit = document.getElementById("late-reason-habit");
  els.reasonUnforeseen = document.getElementById("late-reason-unforeseen");
  els.reasonEnterTime = document.getElementById("late-reason-enter-time");
  els.reasonCancel = document.getElementById("late-reason-cancel");

  els.checkinModal = document.getElementById("checkin-form-modal");
  els.checkinTitle = document.getElementById("checkin-form-title");
  els.checkinHour = document.getElementById("checkin-form-hour");
  els.checkinMinute = document.getElementById("checkin-form-minute");
  els.checkinSave = document.getElementById("checkin-form-save");
  els.checkinCancel = document.getElementById("checkin-form-cancel");

  populateTimeSelects();

  els.btn.addEventListener("click", handleCheckin);
  els.revealClose.addEventListener("click", () => hideModal(els.revealModal));

  els.reasonHabit.addEventListener("click", () => resolveLateReason("habit"));
  els.reasonUnforeseen.addEventListener("click", () => resolveLateReason("unforeseen"));
  els.reasonEnterTime.addEventListener("click", () => resolveLateReason("enter-time"));
  els.reasonCancel.addEventListener("click", () => resolveLateReason(null));

  els.checkinCancel.addEventListener("click", () => hideModal(els.checkinModal));
  els.checkinSave.addEventListener("click", handleArrivalTimeSave);
}

function populateTimeSelects() {
  let hourHtml = "";
  for (let h = 0; h < 24; h++) {
    const v = String(h).padStart(2, "0");
    hourHtml += `<option value="${v}">${v}</option>`;
  }
  els.checkinHour.innerHTML = hourHtml;

  let minuteHtml = "";
  for (let m = 0; m < 60; m += 5) {
    const v = String(m).padStart(2, "0");
    minuteHtml += `<option value="${v}">${v}</option>`;
  }
  els.checkinMinute.innerHTML = minuteHtml;
}

function resolveLateReason(value) {
  hideModal(els.reasonModal);
  if (reasonResolve) {
    const resolve = reasonResolve;
    reasonResolve = null;
    resolve(value);
  }
}

function promptLateReason(dateStr) {
  const available = isLateExemptionAvailable(App.checkinsByDate, App.shiftsByDate, dateStr);
  els.reasonNote.textContent = available
    ? 'בחירת "נסיבות מיוחדות" תשמור על הרצף הפעם.'
    : "כבר נעשה שימוש באפשרות הזו ברצף הנוכחי — הפעם האיחור ישפיע על הרצף.";
  showModal(els.reasonModal);
  return new Promise((resolve) => {
    reasonResolve = (value) => resolve({ reason: value, exempted: value === "unforeseen" && available });
  });
}

/**
 * Opens the arrival-time entry form for dateStr — used both to backfill or
 * correct a past day's arrival (called from ui-history.js) and, for today,
 * as the "I actually arrived on time, I just tapped late" correction path
 * out of the late-reason prompt.
 */
export function openArrivalTimeForm(dateStr) {
  checkinEditingDate = dateStr;
  const existing = App.checkinsByDate.get(dateStr);
  const shift = App.shiftsByDate.get(dateStr);
  const d = parseLocalDate(dateStr);
  const dateLabel = d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" });

  els.checkinTitle.textContent = `שעת הגעה — ${dateLabel}`;

  let hour, minute;
  if (existing) {
    const t = new Date(existing.timestamp);
    const snapped = snapToTimeOptions(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
    hour = snapped.hour;
    minute = snapped.minute;
  } else if (dateStr === formatLocalDate(new Date())) {
    const now = new Date();
    const snapped = snapToTimeOptions(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    hour = snapped.hour;
    minute = snapped.minute;
  } else {
    const snapped = snapToTimeOptions(shift.startTime);
    hour = snapped.hour;
    minute = snapped.minute;
  }
  els.checkinHour.value = hour;
  els.checkinMinute.value = minute;

  showModal(els.checkinModal);
}

async function handleArrivalTimeSave() {
  const d = parseLocalDate(checkinEditingDate);
  const hour = parseInt(els.checkinHour.value, 10);
  const minute = parseInt(els.checkinMinute.value, 10);
  const arrivalDateTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0);
  const shift = App.shiftsByDate.get(checkinEditingDate);
  const result = computeCheckinResult(arrivalDateTime, shift);

  hideModal(els.checkinModal);
  await commitCheckinResult(result);
}

export async function commitCheckinResult(result) {
  let finalResult = result;
  let exempted = false;
  if (result.status === "late") {
    const choice = await promptLateReason(result.date);
    if (choice.reason === null) return false;
    if (choice.reason === "enter-time") {
      openArrivalTimeForm(result.date);
      return false;
    }
    finalResult = { ...result, lateReason: choice.reason };
    exempted = choice.exempted;
  }

  await saveCheckin(finalResult);
  await refreshAll();

  if (finalResult.status === "on-time") {
    await celebrateOnTimeCheckin(finalResult.date);
  } else {
    showLateFeedback(exempted);
  }
  return true;
}

async function handleCheckin() {
  const today = formatLocalDate(new Date());
  const existing = await getCheckin(today);
  if (existing) return;

  const todayShift = App.shiftsByDate.get(today);
  if (!todayShift) return;

  const result = computeCheckinResult(new Date(), todayShift);
  await commitCheckinResult(result);
}

function showLateFeedback(exempted) {
  els.revealImg.style.display = "none";
  els.revealPlaceholder.style.display = "flex";
  if (exempted) {
    els.revealPlaceholder.textContent = "🙌";
    els.revealTitle.textContent = "הרצף נשמר!";
    els.revealSub.textContent = "האיחור הזה לא נספר הפעם, בזכות הפטור החד-פעמי.";
  } else {
    els.revealPlaceholder.textContent = "😌";
    els.revealTitle.textContent = "זה בסדר";
    els.revealSub.textContent = "האיחור הזה משפיע על הרצף שלך.";
  }
  els.revealClose.textContent = "בסדר";
  showModal(els.revealModal);
}

export async function celebrateOnTimeCheckin(dateStr) {
  const newStreak = App.currentStreak;
  const tier = getTierForStreak(newStreak);
  celebrate(els.canvas, tier, App.settings.soundEnabled);

  const award = await evaluateAndAwardPrize(App, dateStr);
  if (award) {
    showPrizeReveal(award);
  }
}

export function showPrizeReveal(award) {
  const tier = getTierByKey(award.tierKey);
  if (award.prizeFile) {
    els.revealImg.src = `prizes/${award.prizeFile}`;
    els.revealImg.style.display = "block";
    els.revealPlaceholder.style.display = "none";
  } else {
    els.revealImg.style.display = "none";
    els.revealPlaceholder.style.display = "flex";
    els.revealPlaceholder.textContent = "🎉";
  }
  els.revealTitle.textContent = `זכית בפרס! (${tier ? tier.label : ""})`;
  els.revealSub.textContent = award.prizeTitle;
  els.revealClose.textContent = "מעולה!";
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

  const active = app.prizeAwards[0];
  if (active) {
    const tier = getTierByKey(active.tierKey);
    els.rewardCard.innerHTML = `
      <img src="prizes/${active.prizeFile}" alt="${escapeHtml(active.prizeTitle)}" onerror="this.style.display='none'">
      <div>
        <div class="reward-title">${escapeHtml(active.prizeTitle)}</div>
        <div class="reward-sub">${tier ? tier.label : ""} · יום ${active.streakDay}</div>
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

  const next = daysUntilNextPrize(app.currentStreak);
  els.nextPrize.textContent = next
    ? `הפרס הבא בעוד ${next.days} ${next.days === 1 ? "יום" : "ימים"}`
    : "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
