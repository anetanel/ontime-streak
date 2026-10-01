import { getMyInvites, createInvite, deleteInvite, getMyGuestGrants, revokeGuestGrant } from "./db.js";
import { showModal, hideModal, App } from "./app.js";
import { pick, normalizeGender } from "./gender.js";

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
  els.genderToggle = document.getElementById("invite-gender-toggle");
  els.genderToggle.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-gender]");
    if (!btn) return;
    [...els.genderToggle.children].forEach((b) => b.classList.toggle("active", b === btn));
  });
}

function inviteLink(id) {
  return `${window.location.origin}${window.location.pathname}?invite=${id}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    prompt(pick(App.settings.gender, "העתק את הקישור:", "העתיקי את הקישור:"), text);
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
      if (!confirm("להסיר את האורח/ת? הקישור יפסיק לעבוד והגישה תבוטל מיד.")) return;
      // Revoke every grant first: a grant outlives its invite, so deleting
      // only the invite would leave connected guests with access.
      for (const uid of el.dataset.uids.split(",").filter(Boolean)) {
        await revokeGuestGrant(uid);
      }
      await deleteInvite(el.dataset.id);
      await refresh();
    });
  });
}

function renderInviteRow(invite, guestGrants) {
  const gender = invite.gender;
  let status = pick(gender, "ממתין להצטרפות", "ממתינה להצטרפות");
  if (guestGrants.length) {
    const since = guestGrants.map((g) => g.grantedAt).sort()[0];
    status = `${pick(gender, "מחובר", "מחוברת")} מאז ${formatDate(since)}`;
    if (guestGrants.length > 1) status += ` · ${guestGrants.length} מכשירים`;
  }
  const uids = guestGrants.map((g) => g.uid).join(",");

  return `
    <div class="invite-item">
      <div class="invite-info">
        <div class="invite-label">${escapeHtml(invite.label || "ללא שם")}</div>
        <div class="stat-label">${status}</div>
      </div>
      <button class="icon-btn" data-copy-link data-id="${invite.id}" title="העתקת קישור">🔗</button>
      <button class="icon-btn" data-delete-invite data-id="${invite.id}" data-uids="${uids}" title="הסרה">🗑️</button>
    </div>
  `;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

async function handleCreate() {
  const label = els.labelInput.value.trim();
  els.createBtn.disabled = true;
  try {
    const gender = els.genderToggle.querySelector(".active").dataset.gender;
    const id = await createInvite(label, gender);
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
