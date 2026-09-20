import { App, refreshAll } from "./app.js";
import { PRIZE_TIERS, getTierByKey, daysUntilNextPrize } from "./prizes.js";
import { parseLocalDate } from "./streak.js";
import { deleteMyComment } from "./db.js";

let els = {};

export function initPrizes() {
  els.nextInfo = document.getElementById("next-prize-info");
  els.tierLegend = document.getElementById("tier-legend");
  els.list = document.getElementById("prizes-list");
  els.empty = document.getElementById("prizes-empty");

  els.tierLegend.innerHTML = PRIZE_TIERS.slice()
    .reverse()
    .map((t) => {
      const count = (App.prizeManifest && App.prizeManifest[t.key] && App.prizeManifest[t.key].prizes.length) || 0;
      return `<div class="row-toggle"><span>${t.label}</span><span class="stat-label">${count} תמונות בקבוצה</span></div>`;
    })
    .join("");
}

export function renderPrizes(app) {
  const next = daysUntilNextPrize(app.currentStreak);
  els.nextInfo.textContent = next
    ? `הפרס הבא בעוד ${next.days} ${next.days === 1 ? "יום" : "ימים"} (${next.tier.label})`
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
      const tier = getTierByKey(a.tierKey);
      const comments = app.commentsByAward.get(a.date) || [];
      const commentsHtml = comments
        .slice()
        .sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))
        .map(
          (c) => `
            <div class="comment-item">
              <div class="comment-content">
                <div><b>${escapeHtml(c.authorLabel || "אורחת")}:</b> ${escapeHtml(c.text)}</div>
                <div class="comment-time">${formatCommentTime(c.createdAt)}</div>
              </div>
              <button class="icon-btn" data-delete-comment data-id="${c.id}" title="מחיקת תגובה">🗑️</button>
            </div>
          `
        )
        .join("");

      return `
        <div class="reward-item">
          <img src="prizes/${a.prizeFile}" alt="" onerror="this.style.display='none'">
          <div class="info">
            <div class="title">${escapeHtml(a.prizeTitle)}</div>
            <div class="sub">${tier ? tier.label : ""} · יום ${a.streakDay} · ${dateLabel}</div>
          </div>
        </div>
        ${comments.length ? `<div class="comments-list">${commentsHtml}</div>` : ""}
      `;
    })
    .join("");

  els.list.querySelectorAll("[data-delete-comment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("למחוק את התגובה?")) return;
      await deleteMyComment(btn.dataset.id);
      await refreshAll();
    });
  });
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
