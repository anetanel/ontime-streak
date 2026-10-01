import { auth, signOutUser } from "./firebase-init.js";
import {
  getPrizeAwardsForHousehold,
  getCommentsForHousehold,
  addCommentToHousehold,
  getCheckinsForHousehold,
  getShiftsForHousehold,
  getStreakStateForHousehold,
  getInvite,
} from "./db.js";
import { streakPeriodLabel, streakRuleLabel, isHighAward } from "./prizes.js";
import {
  CELEBRATION_TIERS,
  computeStreak,
  computeLongestStreak,
  onTimePercent,
  formatLocalDate,
  parseLocalDate,
} from "./streak.js";

let currentGrant = null;
let listEl = null;
let checkinsByDate = new Map();
let shiftsByDate = new Map();
let calState = { year: new Date().getFullYear(), month: new Date().getMonth(), range: "week" };
let wired = false;

export async function renderGuestView(grant) {
  currentGrant = grant;
  listEl = listEl || document.getElementById("guest-prizes-list");

  wireControls();
  await Promise.all([renderHeader(), loadStats(), refresh()]);
}

function wireControls() {
  if (wired) return;
  wired = true;

  const rerenderCalendar = () => renderCalendar();
  document.getElementById("guest-cal-prev").addEventListener("click", () => {
    calState.month -= 1;
    if (calState.month < 0) { calState.month = 11; calState.year -= 1; }
    rerenderCalendar();
  });
  document.getElementById("guest-cal-next").addEventListener("click", () => {
    calState.month += 1;
    if (calState.month > 11) { calState.month = 0; calState.year += 1; }
    rerenderCalendar();
  });
  document.getElementById("guest-cal-today-btn").addEventListener("click", () => {
    const now = new Date();
    calState.year = now.getFullYear();
    calState.month = now.getMonth();
    rerenderCalendar();
  });
  const toggle = document.getElementById("guest-pct-range-toggle");
  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-range]");
    if (!btn) return;
    calState.range = btn.dataset.range;
    [...toggle.children].forEach((b) => b.classList.toggle("active", b === btn));
    renderPct();
  });
}

// Read-only: unlike the admin's loadAll, a guest never writes streak state.
async function loadStats() {
  const [checkins, shifts, streakState] = await Promise.all([
    getCheckinsForHousehold(currentGrant.householdId),
    getShiftsForHousehold(currentGrant.householdId),
    getStreakStateForHousehold(currentGrant.householdId),
  ]);
  checkinsByDate = new Map(checkins.map((c) => [c.date, c]));
  shiftsByDate = new Map(shifts.map((s) => [s.date, s]));

  const now = new Date();
  const current = computeStreak(checkinsByDate, shiftsByDate, now);
  const longest = Math.max(streakState.longestStreak || 0, computeLongestStreak(checkinsByDate, shiftsByDate, now), current);

  document.getElementById("guest-current-streak").textContent = current;
  document.getElementById("guest-longest-streak").textContent = longest;
  document.getElementById("guest-hist-current").textContent = current;
  document.getElementById("guest-hist-longest").textContent = longest;

  document.getElementById("guest-tier-stars").innerHTML = CELEBRATION_TIERS.map((t) => {
    const earned = current >= t.min;
    return `<div class="tier-star${earned ? " earned" : ""}"><span class="star">${earned ? "⭐" : "☆"}</span><span class="stat-label">${t.min}</span></div>`;
  }).join("");

  renderPct();
  renderCalendar();
}

function renderPct() {
  const { pct, label } = onTimePercent(checkinsByDate, shiftsByDate, calState.range);
  document.getElementById("guest-hist-pct-label").textContent = label;
  document.getElementById("guest-hist-pct").textContent = pct !== null ? `${pct}%` : "—";
}

// Only resolved days with a check-in are marked; no future shifts, no times.
function renderCalendar() {
  const { year, month } = calState;
  const monthDate = new Date(year, month, 1);
  document.getElementById("guest-cal-month-label").textContent = monthDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  const now = new Date();
  const todayStr = formatLocalDate(now);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  document.getElementById("guest-cal-today-row").style.display = isCurrentMonth ? "none" : "block";

  const firstDow = monthDate.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = "";
  ["א", "ב", "ג", "ד", "ה", "ו", "ש"].forEach((d) => {
    html += `<div class="cal-dow">${d}</div>`;
  });
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatLocalDate(new Date(year, month, day));
    const rec = dateStr <= todayStr ? checkinsByDate.get(dateStr) : null;
    const cls = rec ? (rec.status === "on-time" ? "on-time" : "late") : "none";
    const todayCls = dateStr === todayStr ? " today" : "";
    html += `<div class="cal-day ${cls}${todayCls}"><span class="cal-day-num">${day}</span></div>`;
  }
  document.getElementById("guest-calendar-grid").innerHTML = html;
}

async function renderHeader() {
  const photo = document.getElementById("guest-owner-photo");
  const photoPlaceholder = document.getElementById("guest-owner-photo-placeholder");
  const ownerNameEl = document.getElementById("guest-owner-name");
  const viewerLabelEl = document.getElementById("guest-viewer-label");
  const signoutBtn = document.getElementById("guest-signout-btn");

  viewerLabelEl.textContent = currentGrant.label ? `מחוברת בתור ${currentGrant.label}` : "";
  signoutBtn.onclick = () => signOutUser();

  const invite = await getInvite(currentGrant.invite).catch(() => null);
  const ownerName = invite && invite.ownerName;
  const ownerPhotoURL = invite && invite.ownerPhotoURL;

  ownerNameEl.textContent = ownerName || "";

  if (ownerPhotoURL) {
    photo.src = ownerPhotoURL;
    photo.style.display = "block";
    photoPlaceholder.style.display = "none";
    photo.onerror = () => {
      photo.style.display = "none";
      photoPlaceholder.style.display = "flex";
    };
  } else {
    photo.style.display = "none";
    photoPlaceholder.style.display = "flex";
  }
}

async function refresh() {
  const [awards, comments] = await Promise.all([
    getPrizeAwardsForHousehold(currentGrant.householdId),
    getCommentsForHousehold(currentGrant.householdId),
  ]);
  awards.sort((a, b) => (a.date < b.date ? 1 : -1));

  const commentsByAward = {};
  comments.forEach((c) => {
    (commentsByAward[c.prizeAwardDate] ||= []).push(c);
  });

  if (!awards.length) {
    listEl.innerHTML = `<div class="empty-hint">עוד אין פרסים לשתף.</div>`;
    return;
  }

  listEl.innerHTML = awards.map((award) => renderAwardCard(award, commentsByAward[award.date] || [])).join("");

  listEl.querySelectorAll("[data-comment-form]").forEach((form) => {
    form.addEventListener("submit", handleCommentSubmit);
  });
}

function renderAwardCard(award, awardComments) {
  const commentsHtml = awardComments
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map(
      (c) => `
        <div class="comment-item">
          <div class="comment-content">
            <div><b>${escapeHtml(c.authorLabel || "אורחת")}:</b> ${escapeHtml(c.text)}</div>
            <div class="comment-time">${formatCommentTime(c.createdAt)}</div>
          </div>
        </div>
      `
    )
    .join("");

  return `
    <div class="card">
      <div class="reward-item${isHighAward(award) ? " high" : ""}">
        <img src="prizes/${award.prizeFile}" alt="" onerror="this.style.display='none'">
        <div class="info">
          <div class="title">${escapeHtml(award.prizeTitle)}</div>
          <div class="sub">${streakPeriodLabel(award.streakDay)} · ${streakRuleLabel(award.streakDay)} · ${formatAwardDate(award.date)}</div>
        </div>
      </div>
      <div class="comments-list">${commentsHtml}</div>
      <form class="comment-form" data-comment-form data-award-date="${award.date}">
        <input type="text" class="comment-input" placeholder="השאירי ברכה…" required maxlength="300">
        <button type="submit" class="btn btn-primary">שליחה</button>
      </form>
    </div>
  `;
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector(".comment-input");
  const text = input.value.trim();
  if (!text) return;

  const btn = form.querySelector("button");
  btn.disabled = true;
  try {
    await addCommentToHousehold({
      householdId: currentGrant.householdId,
      prizeAwardDate: form.dataset.awardDate,
      authorUid: auth.currentUser.uid,
      authorLabel: currentGrant.label || "אורחת",
      text,
    });
    await refresh();
  } catch (err) {
    console.error("addComment failed:", err);
    alert("שליחת התגובה נכשלה. נסי שוב.");
    btn.disabled = false;
  }
}

function formatAwardDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

function formatCommentTime(iso) {
  const d = new Date(iso);
  const dateLabel = d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
  const timeLabel = d.toLocaleTimeString("he-IL", { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${timeLabel}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
