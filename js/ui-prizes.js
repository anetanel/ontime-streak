import { App, refreshAll } from "./app.js";
import { streakPeriodLabel, streakRuleLabel, daysUntilNextPrize, isHighAward } from "./prizes.js";
import { parseLocalDate } from "./streak.js";
import { deleteMyComment, myHouseholdId } from "./db.js";
import { escapeHtml, formatCommentTime, likeButtonHtml, wireLikeButtons } from "./comments-util.js";

let els = {};

export function initPrizes() {
  els.nextInfo = document.getElementById("next-prize-info");
  els.list = document.getElementById("prizes-list");
  els.empty = document.getElementById("prizes-empty");
}

export function renderPrizes(app) {
  const next = daysUntilNextPrize(app.currentStreak);
  els.nextInfo.textContent = next
    ? `הפרס הבא בעוד ${next.days} ${next.days === 1 ? "יום" : "ימים"} (${next.tier.label}, ${streakRuleLabel(app.currentStreak + next.days)})`
    : "";

  if (app.prizeAwards.length === 0) {
    els.list.innerHTML = "";
    els.empty.style.display = "block";
    return;
  }
  els.empty.style.display = "none";

  els.list.innerHTML = app.prizeAwards
    .map((a) => {
      const d = parseLocalDate(a.date);
      const dateLabel = d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
      const comments = app.commentsByAward.get(a.date) || [];
      const commentsHtml = comments
        .slice()
        .sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))
        .map(
          (c) => `
            <div class="comment-item${c.readAt ? "" : " unread"}">
              <div class="comment-content">
                <div><b>${escapeHtml(c.authorLabel || "אורח/ת")}:</b> ${escapeHtml(c.text)}</div>
                <div class="comment-time">${formatCommentTime(c.createdAt)}</div>
              </div>
              ${likeButtonHtml(c)}
              <button class="icon-btn" data-delete-comment data-id="${c.id}" title="מחיקת תגובה">🗑️</button>
            </div>
          `
        )
        .join("");

      return `
        <div class="reward-item${isHighAward(a) ? " high" : ""}">
          <img src="prizes/${a.prizeFile}" alt="" onerror="this.style.display='none'">
          <div class="info">
            <div class="title">${escapeHtml(a.prizeTitle)}</div>
            <div class="sub">${streakPeriodLabel(a.streakDay)} · ${streakRuleLabel(a.streakDay)} · ${dateLabel}</div>
          </div>
        </div>
        ${comments.length ? `<div class="comments-list">${commentsHtml}</div>` : ""}
      `;
    })
    .join("");

  wireLikeButtons(els.list, [...app.commentsByAward.values()].flat(), myHouseholdId(), () => renderPrizes(app));

  els.list.querySelectorAll("[data-delete-comment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("למחוק את התגובה?")) return;
      await deleteMyComment(btn.dataset.id);
      await refreshAll();
    });
  });
}
