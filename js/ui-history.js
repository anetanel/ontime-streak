import { formatLocalDate, parseLocalDate, isScheduledDay } from "./streak.js";
import { showModal, hideModal } from "./app.js";

let els = {};
let state = {
  range: "week",
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
};

export function initHistory() {
  els.current = document.getElementById("hist-current");
  els.longest = document.getElementById("hist-longest");
  els.pct = document.getElementById("hist-pct");
  els.pctLabel = document.getElementById("hist-pct-label");
  els.rangeToggle = document.getElementById("pct-range-toggle");
  els.calPrev = document.getElementById("cal-prev");
  els.calNext = document.getElementById("cal-next");
  els.calLabel = document.getElementById("cal-month-label");
  els.calGrid = document.getElementById("calendar-grid");
  els.trendChart = document.getElementById("trend-chart");
  els.trendEmpty = document.getElementById("trend-empty");
  els.dayModal = document.getElementById("day-detail-modal");
  els.dayTitle = document.getElementById("day-detail-title");
  els.dayBody = document.getElementById("day-detail-body");
  els.dayClose = document.getElementById("day-detail-close");

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

  els.dayClose.addEventListener("click", () => hideModal(els.dayModal));
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

function classifyDay(app, dateStr, isFuture) {
  const scheduled = isScheduledDay(dateStr, app.settings.weeklySchedule);
  const rec = app.checkinsByDate.get(dateStr);
  if (rec && rec.isBonusDay) return "bonus";
  if (rec && rec.status === "on-time") return "on-time";
  if (rec && rec.status === "late") return "late";
  if (!scheduled) return "none";
  if (isFuture) return "none";
  return "missed";
}

function renderStats(app) {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  let start;
  let label;

  if (state.range === "week") {
    start = new Date(now); start.setDate(start.getDate() - 6);
    label = "On-Time (7 days)";
  } else if (state.range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "On-Time (Month)";
  } else {
    const dates = app.checkins.map((c) => c.date).sort();
    start = dates.length ? parseLocalDate(dates[0]) : new Date(now);
    label = "On-Time (All Time)";
  }

  let onTime = 0;
  let total = 0;
  const cursor = new Date(start);
  while (formatLocalDate(cursor) <= todayStr) {
    const dateStr = formatLocalDate(cursor);
    if (isScheduledDay(dateStr, app.settings.weeklySchedule)) {
      const rec = app.checkinsByDate.get(dateStr);
      if (rec && !rec.isBonusDay) {
        total += 1;
        if (rec.status === "on-time") onTime += 1;
      } else if (!rec && dateStr !== todayStr) {
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
  els.calLabel.textContent = monthDate.toLocaleDateString([], { month: "long", year: "numeric" });

  const now = new Date();
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
  els.calNext.style.visibility = isCurrentMonth ? "hidden" : "visible";

  const firstDow = monthDate.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = "";
  ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => {
    html += `<div class="cal-dow">${d}</div>`;
  });
  for (let i = 0; i < firstDow; i++) {
    html += `<div class="cal-day empty"></div>`;
  }
  const todayStr = formatLocalDate(now);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(calYear, calMonth, day);
    const dateStr = formatLocalDate(d);
    const isFuture = dateStr > todayStr;
    const cls = classifyDay(app, dateStr, isFuture);
    html += `<div class="cal-day ${cls}" data-date="${dateStr}">${day}</div>`;
  }
  els.calGrid.innerHTML = html;

  els.calGrid.querySelectorAll(".cal-day[data-date]").forEach((el) => {
    el.addEventListener("click", () => showDayDetail(app, el.dataset.date));
  });
}

function showDayDetail(app, dateStr) {
  const rec = app.checkinsByDate.get(dateStr);
  const d = parseLocalDate(dateStr);
  els.dayTitle.textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  if (rec) {
    const time = new Date(rec.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (rec.isBonusDay) {
      els.dayBody.textContent = `Checked in at ${time} on a non-scheduled day — doesn't affect your streak.`;
    } else if (rec.status === "on-time") {
      els.dayBody.textContent = `On time — arrived at ${time}.`;
    } else {
      els.dayBody.textContent = `Late by ${rec.minutesLate} min — arrived at ${time}.`;
    }
  } else if (isScheduledDay(dateStr, app.settings.weeklySchedule)) {
    els.dayBody.textContent = dateStr > formatLocalDate(new Date()) ? "Upcoming scheduled work day." : "No check-in recorded — counted as missed.";
  } else {
    els.dayBody.textContent = "Not a scheduled work day.";
  }
  showModal(els.dayModal);
}

function renderTrend(app) {
  const recent = app.checkins
    .filter((c) => !c.isBonusDay)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-14);

  if (recent.length < 2) {
    els.trendChart.innerHTML = "";
    els.trendEmpty.style.display = "block";
    return;
  }
  els.trendEmpty.style.display = "none";

  const [gh, gm] = app.settings.expectedStartTime.split(":").map(Number);
  const deadlineMinutes = gh * 60 + gm + app.settings.graceMinutes;

  const minutesOf = (rec) => {
    const t = new Date(rec.timestamp);
    return t.getHours() * 60 + t.getMinutes();
  };

  const values = recent.map(minutesOf);
  const minY = Math.min(...values, deadlineMinutes) - 10;
  const maxY = Math.max(...values, deadlineMinutes) + 10;
  const w = 300, h = 140, padX = 10, padY = 10;

  const xFor = (i) => padX + (i / (recent.length - 1)) * (w - padX * 2);
  const yFor = (m) => h - padY - ((m - minY) / (maxY - minY)) * (h - padY * 2);

  const deadlineY = yFor(deadlineMinutes);
  let svg = `<line x1="${padX}" y1="${deadlineY}" x2="${w - padX}" y2="${deadlineY}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4,3" opacity="0.6" />`;

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
