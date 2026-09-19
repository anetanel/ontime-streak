import { formatLocalDate, parseLocalDate, isScheduledDay, isLateExemptionAvailable, snapToTimeOptions } from "./streak.js";
import { showModal, hideModal, refreshAll } from "./app.js";
import { saveShift, deleteShift } from "./db.js";
import { openArrivalTimeForm } from "./ui-home.js";

let els = {};
let state = {
  range: "week",
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
};
let shiftEditingDate = null;
let dayDetailDate = null;

export function initHistory() {
  els.current = document.getElementById("hist-current");
  els.longest = document.getElementById("hist-longest");
  els.pct = document.getElementById("hist-pct");
  els.pctLabel = document.getElementById("hist-pct-label");
  els.rangeToggle = document.getElementById("pct-range-toggle");
  els.calPrev = document.getElementById("cal-prev");
  els.calNext = document.getElementById("cal-next");
  els.calLabel = document.getElementById("cal-month-label");
  els.calTodayRow = document.getElementById("cal-today-row");
  els.calTodayBtn = document.getElementById("cal-today-btn");
  els.calGrid = document.getElementById("calendar-grid");
  els.dayModal = document.getElementById("day-detail-modal");
  els.dayTitle = document.getElementById("day-detail-title");
  els.dayBody = document.getElementById("day-detail-body");
  els.dayEdit = document.getElementById("day-detail-edit");
  els.dayClose = document.getElementById("day-detail-close");

  els.shiftModal = document.getElementById("shift-form-modal");
  els.shiftTitle = document.getElementById("shift-form-title");
  els.shiftHour = document.getElementById("shift-form-hour");
  els.shiftMinute = document.getElementById("shift-form-minute");
  els.shiftSave = document.getElementById("shift-form-save");
  els.shiftDelete = document.getElementById("shift-form-delete");
  els.shiftCancel = document.getElementById("shift-form-cancel");

  populateTimeSelects(els.shiftHour, els.shiftMinute);

  els.rangeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-range]");
    if (!btn) return;
    state.range = btn.dataset.range;
    [...els.rangeToggle.children].forEach((b) => b.classList.toggle("active", b === btn));
    renderHome_lastApp && renderStats(renderHome_lastApp);
  });

  els.calPrev.addEventListener("click", () => {
    state.calMonth -= 1;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear -= 1; }
    renderHome_lastApp && renderCalendar(renderHome_lastApp);
  });

  els.calNext.addEventListener("click", () => {
    const now = new Date();
    if (state.calYear === now.getFullYear() && state.calMonth === now.getMonth()) return;
    state.calMonth += 1;
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear += 1; }
    renderHome_lastApp && renderCalendar(renderHome_lastApp);
  });

  els.calTodayBtn.addEventListener("click", () => {
    const now = new Date();
    state.calYear = now.getFullYear();
    state.calMonth = now.getMonth();
    renderHome_lastApp && renderCalendar(renderHome_lastApp);
  });

  els.dayClose.addEventListener("click", () => hideModal(els.dayModal));
  els.dayEdit.addEventListener("click", () => {
    hideModal(els.dayModal);
    openArrivalTimeForm(dayDetailDate);
  });

  els.shiftCancel.addEventListener("click", () => hideModal(els.shiftModal));
  els.shiftSave.addEventListener("click", handleSaveShift);
  els.shiftDelete.addEventListener("click", handleDeleteShift);
}

function populateTimeSelects(hourEl, minuteEl) {
  let hourHtml = "";
  for (let h = 0; h < 24; h++) {
    const v = String(h).padStart(2, "0");
    hourHtml += `<option value="${v}">${v}</option>`;
  }
  hourEl.innerHTML = hourHtml;

  let minuteHtml = "";
  for (let m = 0; m < 60; m += 5) {
    const v = String(m).padStart(2, "0");
    minuteHtml += `<option value="${v}">${v}</option>`;
  }
  minuteEl.innerHTML = minuteHtml;
}

let renderHome_lastApp = null;

export function renderHistory(app) {
  renderHome_lastApp = app;
  els.current.textContent = app.currentStreak;
  els.longest.textContent = app.longestStreak;
  renderStats(app);
  renderCalendar(app);
}

function classifyDay(app, dateStr, notYetResolved) {
  const scheduled = isScheduledDay(dateStr, app.shiftsByDate);
  const rec = app.checkinsByDate.get(dateStr);
  if (rec && rec.status === "on-time") return "on-time";
  if (rec && rec.status === "late") {
    if (rec.lateReason === "habit") return "late late-habit";
    if (rec.lateReason === "unforeseen") return "late late-unforeseen";
    return "late";
  }
  if (notYetResolved) return scheduled ? "future-shift" : "none";
  return scheduled ? "missed" : "none";
}

function renderStats(app) {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  let start;
  let label;

  if (state.range === "week") {
    start = new Date(now); start.setDate(start.getDate() - 6);
    label = "אחוז בזמן (7 ימים)";
  } else if (state.range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "אחוז בזמן (חודש)";
  } else {
    const dates = app.checkins.map((c) => c.date).sort();
    start = dates.length ? parseLocalDate(dates[0]) : new Date(now);
    label = "אחוז בזמן (מאז ומתמיד)";
  }

  let onTime = 0;
  let total = 0;
  const cursor = new Date(start);
  while (formatLocalDate(cursor) <= todayStr) {
    const dateStr = formatLocalDate(cursor);
    if (isScheduledDay(dateStr, app.shiftsByDate)) {
      const rec = app.checkinsByDate.get(dateStr);
      if (rec) {
        total += 1;
        if (rec.status === "on-time") onTime += 1;
      } else if (dateStr !== todayStr) {
        total += 1;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  els.pctLabel.textContent = label;
  els.pct.textContent = total > 0 ? `${Math.round((onTime / total) * 100)}%` : "—";
}

function renderCalendar(app) {
  const { calYear, calMonth } = state;
  const monthDate = new Date(calYear, calMonth, 1);
  els.calLabel.textContent = monthDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  const now = new Date();
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
  els.calNext.style.visibility = isCurrentMonth ? "hidden" : "visible";
  els.calTodayRow.style.display = isCurrentMonth ? "none" : "block";

  const firstDow = monthDate.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = "";
  ["א", "ב", "ג", "ד", "ה", "ו", "ש"].forEach((d) => {
    html += `<div class="cal-dow">${d}</div>`;
  });
  for (let i = 0; i < firstDow; i++) {
    html += `<div class="cal-day empty"></div>`;
  }
  const todayStr = formatLocalDate(now);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(calYear, calMonth, day);
    const dateStr = formatLocalDate(d);
    const notYetResolved = dateStr >= todayStr;
    const cls = classifyDay(app, dateStr, notYetResolved);
    const todayCls = dateStr === todayStr ? " today" : "";
    const shift = app.shiftsByDate.get(dateStr);
    const timeHtml = shift ? `<span class="cal-day-time">${shift.startTime}</span>` : "";
    html += `<div class="cal-day ${cls}${todayCls}" data-date="${dateStr}"><span class="cal-day-num">${day}</span>${timeHtml}</div>`;
  }
  els.calGrid.innerHTML = html;

  els.calGrid.querySelectorAll(".cal-day[data-date]").forEach((el) => {
    el.addEventListener("click", () => {
      const dateStr = el.dataset.date;
      const rec = app.checkinsByDate.get(dateStr);
      const todayStr = formatLocalDate(new Date());

      if (rec) {
        showDayDetail(app, dateStr);
        return;
      }
      if (dateStr >= todayStr) {
        openShiftForm(app, dateStr);
        return;
      }
      if (isScheduledDay(dateStr, app.shiftsByDate)) {
        openArrivalTimeForm(dateStr);
      } else {
        showDayDetail(app, dateStr);
      }
    });
  });
}

const LATE_REASON_LABELS = {
  habit: "הרגלים ישנים",
  unforeseen: "נסיבות מיוחדות",
};

function showDayDetail(app, dateStr) {
  const rec = app.checkinsByDate.get(dateStr);
  const d = parseLocalDate(dateStr);
  els.dayTitle.textContent = d.toLocaleDateString("he-IL", { weekday: "long", month: "long", day: "numeric" });
  dayDetailDate = dateStr;

  if (rec) {
    const time = new Date(rec.timestamp).toLocaleTimeString("he-IL", { hour: "numeric", minute: "2-digit" });
    if (rec.status === "on-time") {
      els.dayBody.textContent = `בזמן — הגעת בשעה ${time}.`;
    } else {
      const reasonLabel = LATE_REASON_LABELS[rec.lateReason];
      let text = `איחור של ${rec.minutesLate} דקות — הגעת בשעה ${time}.${reasonLabel ? ` סיבה: ${reasonLabel}.` : ""}`;
      if (rec.lateReason === "unforeseen") {
        const wasExempted = isLateExemptionAvailable(app.checkinsByDate, app.shiftsByDate, dateStr);
        text += wasExempted ? " הרצף נשמר בזכות הפטור החד-פעמי." : " הפטור כבר נוצל קודם ברצף הזה, כך שהאיחור הזה השפיע על הרצף.";
      }
      els.dayBody.textContent = text;
    }
    els.dayEdit.style.display = "block";
  } else {
    els.dayBody.textContent = "אין משמרת ביום זה.";
    els.dayEdit.style.display = "none";
  }
  showModal(els.dayModal);
}

function openShiftForm(app, dateStr) {
  shiftEditingDate = dateStr;
  const existing = app.shiftsByDate.get(dateStr);
  const d = parseLocalDate(dateStr);
  const dateLabel = d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" });

  if (existing) {
    els.shiftTitle.textContent = `עריכת משמרת — ${dateLabel}`;
    const snapped = snapToTimeOptions(existing.startTime);
    els.shiftHour.value = snapped.hour;
    els.shiftMinute.value = snapped.minute;
    els.shiftDelete.style.display = "block";
  } else {
    els.shiftTitle.textContent = `הוספת משמרת — ${dateLabel}`;
    els.shiftHour.value = "10";
    els.shiftMinute.value = "00";
    els.shiftDelete.style.display = "none";
  }
  showModal(els.shiftModal);
}

async function handleSaveShift() {
  const startTime = `${els.shiftHour.value}:${els.shiftMinute.value}`;
  await saveShift({ date: shiftEditingDate, startTime });
  hideModal(els.shiftModal);
  await refreshAll();
}

async function handleDeleteShift() {
  if (!shiftEditingDate) return;
  if (!confirm("למחוק את המשמרת?")) return;
  await deleteShift(shiftEditingDate);
  hideModal(els.shiftModal);
  await refreshAll();
}

