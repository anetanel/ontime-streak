import { computeStreak, formatLocalDate, parseLocalDate, isScheduledDay } from "./streak.js";

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function formatCommentTime(iso) {
  const d = new Date(iso);
  const dateLabel = d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
  const timeLabel = d.toLocaleTimeString("he-IL", { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${timeLabel}`;
}

const DAY_STATUS_LABELS = {
  "on-time": "בזמן",
  late: "איחור",
  "late-unforeseen": "איחור (נסיבות מיוחדות)",
  missed: "לא נרשמה הגעה",
  future: "משמרת עתידית",
  none: "אין משמרת",
};

/** Status of a day for a comment: on-time | late | late-unforeseen | missed | future | none. */
export function dayStatus(dateStr, checkinsByDate, shiftsByDate, now = new Date()) {
  const rec = checkinsByDate.get(dateStr);
  if (rec && rec.status === "on-time") return "on-time";
  if (rec && rec.status === "late") return rec.lateReason === "unforeseen" ? "late-unforeseen" : "late";
  if (!isScheduledDay(dateStr, shiftsByDate)) return "none";
  return dateStr >= formatLocalDate(now) ? "future" : "missed";
}

/** Streak and status as of dateStr (a future day uses today's streak). */
export function dayCommentInfo(dateStr, checkinsByDate, shiftsByDate, now = new Date()) {
  const asOf = dateStr < formatLocalDate(now) ? parseLocalDate(dateStr) : now;
  return {
    streak: computeStreak(checkinsByDate, shiftsByDate, asOf),
    dayStatus: dayStatus(dateStr, checkinsByDate, shiftsByDate, now),
  };
}

/** e.g. "רצף: 12 ימים · בזמן" for a day comment, "" if it has no snapshot. */
export function dayCommentMetaLabel(c) {
  if (c.streak === undefined || c.streak === null) return "";
  const days = c.streak === 1 ? "יום אחד" : `${c.streak} ימים`;
  const status = DAY_STATUS_LABELS[c.dayStatus];
  return `רצף: ${days}${status ? ` · ${status}` : ""}`;
}

export function dayStatusLabel(status) {
  return DAY_STATUS_LABELS[status] || "";
}
