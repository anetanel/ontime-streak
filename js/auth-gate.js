import { auth, signInWithGoogle, signOutUser, signInAsGuest } from "./firebase-init.js";
import { onAuthStateChanged } from "./vendor/firebase-auth.js";
import { ADMIN_EMAILS } from "./firebase-config.js";
import { getGuestGrant, getInvite, redeemInvite, touchGuestGrant } from "./db.js";

let els = {};
let handlers = {};
let bootedRole = null; // "admin" | "guest" — only hand off once per page load

// Set when a guest pastes their link into the gate: an installed iOS PWA
// has its own storage and opens without the ?invite= it was saved from
// (a per-invite manifest start_url doesn't change that on iOS).
let pastedInvite = null;

function getInviteParam() {
  return pastedInvite || new URLSearchParams(window.location.search).get("invite");
}

// Accepts the full link or just the id.
function parseInviteInput(text) {
  const t = text.trim();
  try {
    return new URL(t).searchParams.get("invite") || null;
  } catch {
    return /^[\w-]+$/.test(t) ? t : null;
  }
}

export function initAuthGate({ onAdmin, onGuest }) {
  handlers = { onAdmin, onGuest };

  els.gate = document.getElementById("auth-gate");
  els.app = document.getElementById("app");
  els.guestView = document.getElementById("guest-view");
  els.status = document.getElementById("auth-status");
  els.signinBtn = document.getElementById("google-signin-btn");
  els.signoutBtn = document.getElementById("google-signout-btn");

  els.signinBtn.addEventListener("click", () => {
    els.status.textContent = "מעבר להתחברות עם Google…";
    els.signinBtn.disabled = true;
    signInWithGoogle().catch((err) => {
      console.error("signInWithGoogle failed:", err);
      els.status.textContent = "ההתחברות נכשלה. אפשר לנסות שוב.";
      els.signinBtn.disabled = false;
    });
  });

  els.signoutBtn.addEventListener("click", () => signOutUser());

  els.pasteForm = document.getElementById("invite-paste-form");
  els.pasteInput = document.getElementById("invite-paste-input");
  els.pasteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = parseInviteInput(els.pasteInput.value);
    if (!id) {
      els.status.textContent = "הקישור לא נראה תקין. נסו להדביק אותו שוב.";
      return;
    }
    pastedInvite = id;
    els.status.textContent = "מתחבר…";
    const user = auth.currentUser;
    (user && user.isAnonymous ? handleAuthState(user) : signInAsGuest()).catch((err) => {
      console.error("Pasted invite failed:", err);
      els.status.textContent = "משהו השתבש. אפשר לנסות שוב.";
    });
  });

  onAuthStateChanged(auth, (user) => {
    handleAuthState(user).catch((err) => {
      console.error("Auth flow failed:", err);
      showGate({ message: "משהו השתבש בהתחברות. כדאי לרענן את הדף.", showSignin: true, showSignout: false });
    });
  });
}

async function handleAuthState(user) {
  if (user && !user.isAnonymous && ADMIN_EMAILS.includes(user.email)) {
    showRole("admin");
    return;
  }

  if (user && !user.isAnonymous) {
    showGate({ message: `החשבון ${user.email} לא מורשה לאפליקציה הזו.`, showSignin: false, showSignout: true });
    return;
  }

  const invite = getInviteParam();

  if (user && user.isAnonymous) {
    const existingGrant = await getGuestGrant(user.uid);
    if (existingGrant) {
      touchGuestGrant(user.uid).catch(() => {}); // best-effort; only feeds the admin's "last seen"
      showRole("guest", existingGrant);
      return;
    }
    if (invite) {
      const grant = await tryRedeemInvite(invite, user.uid);
      if (grant) {
        window.history.replaceState({}, "", window.location.pathname);
        showRole("guest", grant);
        return;
      }
      pastedInvite = null;
      showGate({ message: "קישור ההזמנה לא תקין, או שבוטל.", showSignin: true, showSignout: false });
      return;
    }
    // An anonymous session with no guest grant and no invite link isn't
    // useful — fall through to the normal admin sign-in gate.
    showGate({ message: "כדי להמשיך, יש להתחבר עם Google.", showSignin: true, showSignout: false });
    return;
  }

  if (invite) {
    await signInAsGuest(); // triggers another onAuthStateChanged call once it resolves
    return;
  }

  showGate({ message: "כדי להמשיך, יש להתחבר עם Google.", showSignin: true, showSignout: false });
}

async function tryRedeemInvite(inviteId, uid) {
  const invite = await getInvite(inviteId);
  if (!invite || !invite.active || !invite.ownerId) return null;
  await redeemInvite(inviteId, uid, invite.label || "", invite.ownerId, invite.gender);
  return getGuestGrant(uid);
}

function showRole(role, grant) {
  els.gate.classList.add("hidden");
  if (role === "admin") {
    els.guestView.classList.add("hidden");
    els.app.classList.remove("hidden");
    if (bootedRole !== "admin") {
      bootedRole = "admin";
      handlers.onAdmin();
    }
  } else {
    els.app.classList.add("hidden");
    els.guestView.classList.remove("hidden");
    if (bootedRole !== "guest") {
      bootedRole = "guest";
      handlers.onGuest(grant);
    }
  }
}

function showGate({ message, showSignin, showSignout }) {
  els.app.classList.add("hidden");
  els.guestView.classList.add("hidden");
  els.gate.classList.remove("hidden");
  els.status.textContent = message;
  els.signinBtn.style.display = showSignin ? "block" : "none";
  els.signinBtn.disabled = false;
  els.signoutBtn.style.display = showSignout ? "block" : "none";
  els.pasteForm.style.display = showSignin ? "block" : "none";
}
