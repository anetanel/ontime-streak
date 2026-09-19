import { formatLocalDate, parseLocalDate, isScheduledDay, computeCheckinResult, isLateExemptionAvailable } from "./streak.js";
import { showModal, hideModal, refreshAll } from "./app.js";
import { saveShift, deleteShift } from "./db.js";
import { commitCheckinResult } from "./ui-home.js";

let els = {};
let state = {
  range: "week",
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
};
let shiftEditingDate = null;
let dayDetailDate = null;
let checkinEditingDate = null;

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
  els.trendChart = document.getElementById("trend-chart");
  els.trendEmpty = document.getElementById("trend-empty");
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

  els.checkinModal = document.getElementById("checkin-form-modal");
  els.checkinTitle = document.getElementById("checkin-form-title");
  els.checkinHour = document.getElementById("checkin-form-hour");
  els.checkinMinute = document.getElementById("checkin-form-minute");
  els.checkinSave = document.getElementById("checkin-form-save");
  els.checkinCancel = document.getElementById("checkin-form-cancel");

  populateTimeSelects(els.shiftHour, els.shiftMinute);
  populateTimeSelects(els.checkinHour, els.checkinMinute);

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
    openCheckinForm(renderHome_lastApp, dayDetailDate);
  });

  els.shiftCancel.addEventListener("click", () => hideModal(els.shiftModal));
  els.shiftSave.addEventListener("click", handleSaveShift);
  els.shiftDelete.addEventListener("click", handleDeleteShift);

  els.checkinCancel.addEventListener("click", () => hideModal(els.checkinModal));
  els.checkinSave.addEventListener("click", handleCheckinSave);
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
  renderTrend(app);
}

function classifyDay(app, dateStr, notYetResolved) {
  const scheduled = isScheduledDay(dateStr, app.shiftsByDate);
  const rec = app.checkinsByDate.get(dateStr);
  if (rec && rec.status === "on-time") return "on-time";
  if (rec && rec.status === "late") return "late";
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
        openCheckinForm(app, dateStr);
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

function snapToTimeOptions(startTime) {
  let [h, m] = startTime.split(":").map(Number);
  m = Math.round(m / 5) * 5;
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  return { hour: String(h).padStart(2, "0"), minute: String(m).padStart(2, "0") };
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

function openCheckinForm(app, dateStr) {
  checkinEditingDate = dateStr;
  const existing = app.checkinsByDate.get(dateStr);
  const shift = app.shiftsByDate.get(dateStr);
  const d = parseLocalDate(dateStr);
  const dateLabel = d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" });

  els.checkinTitle.textContent = `שעת הגעה — ${dateLabel}`;

  let hour, minute;
  if (existing) {
    const t = new Date(existing.timestamp);
    const snapped = snapToTimeOptions(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
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

async function handleCheckinSave() {
  const d = parseLocalDate(checkinEditingDate);
  const hour = parseInt(els.checkinHour.value, 10);
  const minute = parseInt(els.checkinMinute.value, 10);
  const arrivalDateTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0);
  const shift = renderHome_lastApp.shiftsByDate.get(checkinEditingDate);
  const result = computeCheckinResult(arrivalDateTime, shift, renderHome_lastApp.settings.graceMinutes);

  hideModal(els.checkinModal);
  await commitCheckinResult(result);
}

function renderTrend(app) {
  const recent = app.checkins
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-14);

  if (recent.length < 2) {
    els.trendChart.innerHTML = "";
    els.trendEmpty.style.display = "block";
    return;
  }
  els.trendEmpty.style.display = "none";

  const minutesOf = (rec) => {
    const t = new Date(rec.timestamp);
    return t.getHours() * 60 + t.getMinutes();
  };

  const values = recent.map(minutesOf);
  const minY = Math.min(...values) - 10;
  const maxY = Math.max(...values) + 10;
  const w = 300, h = 140, padX = 10, padY = 10;

  const xFor = (i) => padX + ((recent.length - 1 - i) / (recent.length - 1)) * (w - padX * 2);
  const yFor = (m) => h - padY - ((m - minY) / (maxY - minY)) * (h - padY * 2);

  let svg = "";
  let path = "";
  recent.forEach((rec, i) => {
    const x = xFor(i);
    const y = yFor(minutesOf(rec));
    path += (i === 0 ? "M" : "L") + x + "," + y + " ";
  });
  svg += `<path d="${path}" fill="none" stroke="var(--text-dim)" stroke-width="1.5" opacity="0.5" />`;

  recent.forEach((rec, i) => {
    const x = xFor(i);
    const y = yFor(minutesOf(rec));
    const color = rec.status === "on-time" ? "#34c759" : "#ff3b30";
    svg += `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" />`;
  });

  els.trendChart.innerHTML = svg;
}
