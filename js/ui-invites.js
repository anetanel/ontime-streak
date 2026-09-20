import { getMyInvites, createInvite, setInviteActive, deleteInvite, getMyGuestGrants, revokeGuestGrant } from "./db.js";
import { showModal, hideModal } from "./app.js";

let els = {};

export function initInvites() {
  els.modal = document.getElementById("invites-modal");
  els.openBtn = document.getElementById("manage-invites-btn");
  els.closeBtn = document.getElementById("invites-close-btn");
  els.labelInput = document.getElementById("invite-label-input");
  els.createBtn = document.getElementById("invite-create-btn");
  els.list = document.getElementById("invites-list");
  els.empty = document.getElementById("invites-empty");

  els.openBtn.addEventListener("click", async () => {
    showModal(els.modal);
    await refresh();
  });
  els.closeBtn.addEventListener("click", () => hideModal(els.modal));
  els.createBtn.addEventListener("click", handleCreate);
}

function inviteLink(id) {
  return `${window.location.origin}${window.location.pathname}?invite=${id}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    prompt("העתיקי את הקישור:", text);
    return false;
  }
}

async function refresh() {
  els.list.innerHTML = "";
  els.empty.style.display = "none";

  const [invites, grants] = await Promise.all([getMyInvites(), getMyGuestGrants()]);
  invites.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (!invites.length) {
    els.empty.style.display = "block";
    return;
  }

  const grantsByInvite = {};
  grants.forEach((g) => {
    (grantsByInvite[g.invite] ||= []).push(g);
  });

  els.list.innerHTML = invites.map((invite) => renderInviteRow(invite, grantsByInvite[invite.id] || [])).join("");

  els.list.querySelectorAll("[data-invite-toggle]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      e.target.disabled = true;
      await setInviteActive(e.target.dataset.id, e.target.checked);
      await refresh();
    });
  });

  els.list.querySelectorAll("[data-copy-link]").forEach((el) => {
    el.addEventListener("click", async () => {
      const ok = await copyToClipboard(inviteLink(el.dataset.id));
      if (ok) {
        const original = el.textContent;
        el.textContent = "✓";
        setTimeout(() => { el.textContent = original; }, 1500);
      }
    });
  });

  els.list.querySelectorAll("[data-delete-invite]").forEach((el) => {
    el.addEventListener("click", async () => {
      if (!confirm("למחוק את קישור ההזמנה? זה רק מונע הצטרפות חדשה דרכו — מי שכבר מחובר/ת ימשיך/תמשיך לראות, אלא אם תבטלי את הגישה שלו/ה ברשימת \"מחוברים\" למטה.")) return;
      await deleteInvite(el.dataset.id);
      await refresh();
    });
  });

  els.list.querySelectorAll("[data-revoke-guest]").forEach((el) => {
    el.addEventListener("click", async () => {
      if (!confirm("לבטל את הגישה של האורחת/האורח הזו? לא תוכל/י יותר לראות או להגיב, עד שתקבל/י קישור הזמנה חדש.")) return;
      await revokeGuestGrant(el.dataset.uid);
      await refresh();
    });
  });
}

function renderInviteRow(invite, guestGrants) {
  const guestsHtml = guestGrants
    .slice()
    .sort((a, b) => (a.grantedAt < b.grantedAt ? -1 : 1))
    .map(
      (g) => `
        <div class="comment-item">
          <div class="comment-content">
            <div>${escapeHtml(g.label || "אורחת")}</div>
            <div class="comment-time">מחוברת מאז ${formatDate(g.grantedAt)}</div>
          </div>
          <button class="icon-btn" data-revoke-guest data-uid="${g.uid}" title="ביטול גישה">🚫</button>
        </div>
      `
    )
    .join("");

  return `
    <div class="invite-item">
      <div class="invite-info">
        <div class="invite-label">${escapeHtml(invite.label || "ללא שם")}</div>
        <div class="stat-label">${invite.active ? "פעיל" : "מבוטל"}${guestGrants.length ? ` · ${guestGrants.length} מחוברים` : ""}</div>
      </div>
      <label class="switch">
        <input type="checkbox" ${invite.active ? "checked" : ""} data-invite-toggle data-id="${invite.id}">
        <span class="track"></span>
        <span class="thumb"></span>
      </label>
      <button class="icon-btn" data-copy-link data-id="${invite.id}" title="העתקת קישור">🔗</button>
      <button class="icon-btn" data-delete-invite data-id="${invite.id}" title="מחיקה">🗑️</button>
    </div>
    ${guestGrants.length ? `<div class="comments-list">${guestsHtml}</div>` : ""}
  `;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

async function handleCreate() {
  const label = els.labelInput.value.trim();
  els.createBtn.disabled = true;
  try {
    const id = await createInvite(label);
    els.labelInput.value = "";
    await refresh();
    const ok = await copyToClipboard(inviteLink(id));
    if (ok) alert("ההזמנה נוצרה! הקישור הועתק, אפשר לשלוח אותו עכשיו.");
  } catch (err) {
    console.error("createInvite failed:", err);
    alert("יצירת ההזמנה נכשלה.");
  } finally {
    els.createBtn.disabled = false;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
