import { auth } from "./firebase-init.js";
import { setCommentReaction } from "./db.js";
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

// likes = hearts (the original field), thumbs = thumbs-up; independent maps.
const REACTIONS = {
  likes: { on: "❤️", off: "🤍", title: "לב" },
  thumbs: { on: "👍", off: "👍", title: "לייק" },
};

/** Heart and thumbs-up buttons with counts; filled when the signed-in user has reacted. */
export function likeButtonHtml(c) {
  const uid = auth.currentUser?.uid;
  return Object.entries(REACTIONS)
    .map(([kind, r]) => {
      const map = c[kind] || {};
      const count = Object.keys(map).length;
      const mine = !!map[uid];
      return `<button class="like-btn${mine ? " liked" : ""}" data-like-comment data-kind="${kind}" data-id="${c.id}" title="${r.title}">${mine ? r.on : r.off}${count ? ` <span>${count}</span>` : ""}</button>`;
    })
    .join("");
}

/** Subtle line naming the owner's own reactions on a comment, "" if none. */
export function adminReactionHtml(c, ownerId, ownerName) {
  const icons = Object.entries(REACTIONS)
    .filter(([kind]) => c[kind]?.[ownerId])
    .map(([, r]) => r.on)
    .join(" ");
  return icons ? `<div class="comment-admin-react">${icons} ${escapeHtml(ownerName || "")}</div>` : "";
}

/**
 * Toggles the signed-in user's reaction optimistically on the comment
 * object, calls rerender(), then saves; reverts and rerenders if the save
 * fails.
 */
export function wireLikeButtons(root, comments, householdId, rerender) {
  root.querySelectorAll("[data-like-comment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const kind = btn.dataset.kind;
      const c = comments.find((x) => x.id === btn.dataset.id);
      if (!c || !REACTIONS[kind]) return;
      const uid = auth.currentUser.uid;
      const before = c[kind];
      const liked = !(before && before[uid]);
      c[kind] = { ...(before || {}) };
      if (liked) c[kind][uid] = true;
      else delete c[kind][uid];
      rerender();
      try {
        await setCommentReaction(householdId, c.id, kind, liked);
      } catch (err) {
        console.error("setCommentReaction failed:", err);
        c[kind] = before;
        rerender();
        alert("התגובה לא נשמרה.");
      }
    });
  });
}
