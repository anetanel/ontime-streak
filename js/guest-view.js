import { auth } from "./firebase-init.js";
import { getAllPrizeAwards, getAllComments, addComment } from "./db.js";
import { getTierByKey } from "./prizes.js";

let currentGrant = null;
let listEl = null;

export async function renderGuestView(grant) {
  currentGrant = grant;
  listEl = listEl || document.getElementById("guest-prizes-list");
  await refresh();
}

async function refresh() {
  const [awards, comments] = await Promise.all([getAllPrizeAwards(), getAllComments()]);
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
  const tier = getTierByKey(award.tierKey);
  const commentsHtml = awardComments
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((c) => `<div class="comment-item"><b>${escapeHtml(c.authorLabel || "אורחת")}:</b> ${escapeHtml(c.text)}</div>`)
    .join("");

  return `
    <div class="card">
      <div class="reward-item">
        <img src="prizes/${award.prizeFile}" alt="" onerror="this.style.display='none'">
        <div class="info">
          <div class="title">${escapeHtml(award.prizeTitle)}</div>
          <div class="sub">${tier ? tier.label : ""} · יום ${award.streakDay}</div>
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
    await addComment({
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
