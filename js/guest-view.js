import { auth, signOutUser } from "./firebase-init.js";
import {
  getPrizeAwardsForHousehold,
  getCommentsForHousehold,
  addCommentToHousehold,
  addDayCommentToHousehold,
  getCheckinsForHousehold,
  getShiftsForHousehold,
  getStreakStateForHousehold,
  getInvite,
} from "./db.js";
import { pick } from "./gender.js";
import { escapeHtml, formatCommentTime, dayCommentInfo, dayCommentMetaLabel, likeButtonHtml, wireLikeButtons } from "./comments-util.js";
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
let commentsByDay = new Map();
let awardComments = [];
let openDay = null;
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
  document.getElementById("guest-calendar-grid").addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-day[data-date]");
    if (cell) openDayModal(cell.dataset.date);
  });
  const todayBtn = document.getElementById("guest-comment-today-btn");
  todayBtn.textContent = pick(currentGrant.gender, "הוסף תגובה", "הוסיפי תגובה");
  todayBtn.addEventListener("click", () => {
    openDayModal(formatLocalDate(new Date()));
  });
  document.getElementById("guest-day-close").addEventListener("click", () => {
    document.getElementById("guest-day-modal").classList.add("hidden");
  });
  document.getElementById("guest-day-form").addEventListener("submit", handleDayCommentSubmit);
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
  const [checkins, shifts, streakState, comments] = await Promise.all([
    getCheckinsForHousehold(currentGrant.householdId),
    getShiftsForHousehold(currentGrant.householdId),
    getStreakStateForHousehold(currentGrant.householdId),
    getCommentsForHousehold(currentGrant.householdId),
  ]);
  setDayComments(comments);
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
  renderTodayStatus(now);
  document.getElementById("guest-comment-today-btn").disabled = false;
}

// Worded neutrally: the grant only knows the guest's gender, not the owner's.
function renderTodayStatus(now) {
  const card = document.getElementById("guest-today-status");
  const todayStr = formatLocalDate(now);
  const shift = shiftsByDate.get(todayStr);
  const checkin = checkinsByDate.get(todayStr);
  let icon, title, sub = "";

  if (!shift) {
    icon = "🌴";
    title = "אין משמרת היום";
  } else if (checkin) {
    sub = `🕘 משמרת ב-${shift.startTime}`;
    if (checkin.status === "on-time") {
      icon = "✅";
      title = "הגעה בזמן";
    } else {
      icon = "⏰";
      title = checkin.minutesLate ? `איחור של ${checkin.minutesLate} דקות` : "איחור";
    }
  } else {
    const [h, m] = shift.startTime.split(":").map(Number);
    const started = now.getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
    sub = `🕘 משמרת ב-${shift.startTime}`;
    if (started) {
      icon = "⏰";
      title = "המשמרת התחילה, ועדיין אין הגעה";
    } else {
      icon = "🕒";
      title = "יש משמרת היום, עדיין לא התחילה";
    }
  }

  document.getElementById("guest-today-status-icon").textContent = icon;
  document.getElementById("guest-today-status-title").textContent = title;
  document.getElementById("guest-today-status-sub").textContent = sub;
  card.style.display = "";
}

function renderPct() {
  const { pct, label } = onTimePercent(checkinsByDate, shiftsByDate, calState.range);
  document.getElementById("guest-hist-pct-label").textContent = label;
  document.getElementById("guest-hist-pct").textContent = pct !== null ? `${pct}%` : "—";
}

function setDayComments(comments) {
  commentsByDay = new Map();
  comments.forEach((c) => {
    if (c.dayDate) (commentsByDay.get(c.dayDate) || commentsByDay.set(c.dayDate, []).get(c.dayDate)).push(c);
  });
  renderTodayComments();
}

function dayCommentsHtml(dateStr) {
  return (commentsByDay.get(dateStr) || [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((c) => {
      const meta = dayCommentMetaLabel(c);
      return `
        <div class="comment-item">
          <div class="comment-content">
            <div><b>${escapeHtml(c.authorLabel || "אורח/ת")}:</b> ${escapeHtml(c.text)}</div>
            ${meta ? `<div class="comment-meta">${meta}</div>` : ""}
            <div class="comment-time">${formatCommentTime(c.createdAt)}</div>
          </div>
          ${likeButtonHtml(c)}
        </div>`;
    })
    .join("");
}

function wireDayLikes(root) {
  wireLikeButtons(root, [...commentsByDay.values()].flat(), currentGrant.householdId, () => {
    renderTodayComments();
    if (openDay) renderDayModalComments();
  });
}

function renderTodayComments() {
  const el = document.getElementById("guest-today-comments");
  el.innerHTML = dayCommentsHtml(formatLocalDate(new Date()));
  wireDayLikes(el);
}

// Only resolved days with a check-in are marked; no future shifts, no times.
// Every day is tappable to leave a comment.
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
    const commentCls = commentsByDay.has(dateStr) ? " has-comments" : "";
    html += `<div class="cal-day ${cls}${todayCls}${commentCls}" data-date="${dateStr}"><span class="cal-day-num">${day}</span></div>`;
  }
  document.getElementById("guest-calendar-grid").innerHTML = html;
}

function openDayModal(dateStr) {
  openDay = dateStr;
  const info = dayCommentInfo(dateStr, checkinsByDate, shiftsByDate);
  document.getElementById("guest-day-title").textContent = parseLocalDate(dateStr).toLocaleDateString("he-IL", { weekday: "long", month: "long", day: "numeric" });
  document.getElementById("guest-day-info").textContent = dayCommentMetaLabel(info);
  document.getElementById("guest-day-input").placeholder = pick(currentGrant.gender, "כתוב תגובה…", "כתבי תגובה…");
  renderDayModalComments();
  document.getElementById("guest-day-modal").classList.remove("hidden");
}

function renderDayModalComments() {
  const el = document.getElementById("guest-day-comments");
  el.innerHTML = dayCommentsHtml(openDay);
  wireDayLikes(el);
}

async function handleDayCommentSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("guest-day-input");
  const text = input.value.trim();
  if (!text || !openDay) return;

  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    const info = dayCommentInfo(openDay, checkinsByDate, shiftsByDate);
    await addDayCommentToHousehold({
      householdId: currentGrant.householdId,
      dayDate: openDay,
      streak: info.streak,
      dayStatus: info.dayStatus,
      authorUid: auth.currentUser.uid,
      authorLabel: currentGrant.label || pick(currentGrant.gender, "אורח", "אורחת"),
      text,
    });
    input.value = "";
    setDayComments(await getCommentsForHousehold(currentGrant.householdId));
    renderDayModalComments();
    renderCalendar();
  } catch (err) {
    console.error("addDayComment failed:", err);
    alert(pick(currentGrant.gender, "שליחת התגובה נכשלה. נסה שוב.", "שליחת התגובה נכשלה. נסי שוב."));
  } finally {
    btn.disabled = false;
  }
}

async function renderHeader() {
  const photo = document.getElementById("guest-owner-photo");
  const photoPlaceholder = document.getElementById("guest-owner-photo-placeholder");
  const ownerNameEl = document.getElementById("guest-owner-name");
  const viewerLabelEl = document.getElementById("guest-viewer-label");
  const signoutBtn = document.getElementById("guest-signout-btn");

  viewerLabelEl.textContent = currentGrant.label ? `${pick(currentGrant.gender, "מחובר", "מחוברת")} בתור ${currentGrant.label}` : "";
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

  awardComments = comments.filter((c) => c.prizeAwardDate);
  renderPrizes(awards);
}

function renderPrizes(awards) {
  const commentsByAward = {};
  awardComments.forEach((c) => {
    (commentsByAward[c.prizeAwardDate] ||= []).push(c);
  });

  const latestEl = document.getElementById("guest-latest-prize");
  if (!awards.length) {
    listEl.innerHTML = `<div class="empty-hint">עוד אין פרסים לשתף.</div>`;
    latestEl.innerHTML = renderLatestPrize(null, []);
    return;
  }

  listEl.innerHTML = awards.map((award) => renderAwardCard(award, commentsByAward[award.date] || [])).join("");
  latestEl.innerHTML = renderLatestPrize(awards[0], commentsByAward[awards[0].date] || []);

  [listEl, latestEl].forEach((el) => {
    el.querySelectorAll("[data-comment-form]").forEach((form) => {
      form.addEventListener("submit", handleCommentSubmit);
    });
    wireLikeButtons(el, awardComments, currentGrant.householdId, () => renderPrizes(awards));
  });
}

// Same look as the admin home's last-prize card, plus comments on it.
function renderLatestPrize(award, awardComments) {
  if (!award) {
    return `
      <div class="card reward-card">
        <div class="placeholder">🎵</div>
        <div>
          <div class="reward-title">עוד לא נפתח פרס</div>
          <div class="reward-sub">${pick(currentGrant.gender, "תמשיך ברצף!", "תמשיכי ברצף!")}</div>
        </div>
      </div>`;
  }
  return `
    <div class="card">
      <div class="reward-card${isHighAward(award) ? " high" : ""}" style="margin-bottom:0;">
        <img src="prizes/${award.prizeFile}" alt="${escapeHtml(award.prizeTitle)}" onerror="this.style.display='none'">
        <div>
          <div class="reward-sub" style="margin:0 0 2px;">הפרס האחרון היה:</div>
          <div class="reward-title">${escapeHtml(award.prizeTitle)}</div>
          <div class="reward-sub">${streakPeriodLabel(award.streakDay)} · ${streakRuleLabel(award.streakDay)}</div>
        </div>
      </div>
      ${renderAwardComments(award, awardComments)}
    </div>`;
}

function renderAwardComments(award, awardComments) {
  const commentsHtml = awardComments
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map(
      (c) => `
        <div class="comment-item">
          <div class="comment-content">
            <div><b>${escapeHtml(c.authorLabel || "אורח/ת")}:</b> ${escapeHtml(c.text)}</div>
            <div class="comment-time">${formatCommentTime(c.createdAt)}</div>
          </div>
          ${likeButtonHtml(c)}
        </div>
      `
    )
    .join("");

  return `
    <div class="comments-list">${commentsHtml}</div>
    <form class="comment-form" data-comment-form data-award-date="${award.date}">
      <input type="text" class="comment-input" placeholder="${pick(currentGrant.gender, "השאר ברכה…", "השאירי ברכה…")}" required maxlength="300">
      <button type="submit" class="btn btn-primary">שליחה</button>
    </form>`;
}

function renderAwardCard(award, awardComments) {
  return `
    <div class="card">
      <div class="reward-item${isHighAward(award) ? " high" : ""}">
        <img src="prizes/${award.prizeFile}" alt="" onerror="this.style.display='none'">
        <div class="info">
          <div class="title">${escapeHtml(award.prizeTitle)}</div>
          <div class="sub">${streakPeriodLabel(award.streakDay)} · ${streakRuleLabel(award.streakDay)} · ${formatAwardDate(award.date)}</div>
        </div>
      </div>
      ${renderAwardComments(award, awardComments)}
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
      authorLabel: currentGrant.label || pick(currentGrant.gender, "אורח", "אורחת"),
      text,
    });
    await refresh();
  } catch (err) {
    console.error("addComment failed:", err);
    alert(pick(currentGrant.gender, "שליחת התגובה נכשלה. נסה שוב.", "שליחת התגובה נכשלה. נסי שוב."));
    btn.disabled = false;
  }
}

function formatAwardDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}
