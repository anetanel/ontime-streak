import { auth, signOutUser } from "./firebase-init.js";
import { getPrizeAwardsForHousehold, getCommentsForHousehold, addCommentToHousehold, getInvite } from "./db.js";
import { getTierByKey } from "./prizes.js";

let currentGrant = null;
let listEl = null;

export async function renderGuestView(grant) {
  currentGrant = grant;
  listEl = listEl || document.getElementById("guest-prizes-list");

  await renderHeader();
  await refresh();
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
