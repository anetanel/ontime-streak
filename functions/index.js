const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Data-only: the service worker builds the visible notification (see sw.js).
async function notifyOwner(ownerId, data) {
  const snap = await db.collection(`households/${ownerId}/pushTokens`).get();
  await sendToTokens(snap.docs, data);
}

// Guests whose grant was revoked (🚫) keep their token doc; drop it instead of sending.
async function notifyGuests(ownerId, data) {
  const snap = await db.collection(`households/${ownerId}/guestPushTokens`).get();
  const grants = await Promise.all(snap.docs.map((d) => db.doc(`guestGrants/${d.get("uid")}`).get()));
  const live = [];
  const revoked = [];
  snap.docs.forEach((d, i) => {
    const g = grants[i];
    (g.exists && g.get("householdId") === ownerId ? live : revoked).push(d);
  });
  await Promise.all(revoked.map((d) => d.ref.delete()));
  await sendToTokens(live, data);
}

async function sendToTokens(docs, data) {
  if (!docs.length) return;
  const tokens = docs.map((d) => d.id);
  const res = await getMessaging().sendEachForMulticast({ tokens, data });
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      dead.push(docs[i].ref);
    }
  });
  await Promise.all(dead.map((ref) => ref.delete()));
}

exports.onCommentCreated = onDocumentCreated("households/{ownerId}/comments/{commentId}", async (event) => {
  const c = event.data && event.data.data();
  if (!c) return;
  const text = String(c.text || "");
  // Unread = no readAt; Firestore can't query a missing field, so count here.
  const all = await db.collection(`households/${event.params.ownerId}/comments`).get();
  const unread = all.docs.filter((d) => !d.get("readAt")).length;
  await notifyOwner(event.params.ownerId, {
    title: c.dayDate ? "תגובה חדשה על יום" : "תגובה חדשה על פרס",
    body: `${c.authorLabel || "אורח"}: ${text.length > 120 ? text.slice(0, 117) + "…" : text}`,
    tag: `comment-${event.params.commentId}`,
    badge: String(unread),
  });
});

// Create only (editing a check-in rewrites the same doc), and only for today,
// so backfills and test helpers don't ping guests. Wording is neutral: the
// owner's gender isn't known here.
exports.onCheckinCreated = onDocumentCreated("households/{ownerId}/checkins/{date}", async (event) => {
  const c = event.data && event.data.data();
  if (!c) return;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  if (event.params.date !== today) return;
  await notifyGuests(event.params.ownerId, {
    title: c.status === "on-time" ? "הגעה בזמן למשמרת 🎉" : "הגעה למשמרת",
    body: c.status === "on-time" ? "נרשמה הגעה בזמן להיום" : "נרשמה הגעה באיחור להיום",
    tag: `checkin-${event.params.date}`,
    badge: "1", // cleared when the guest opens the app (guest-view.js)
  });
});

exports.calendarReminder = onSchedule({ schedule: "every day 09:00", timeZone: "Asia/Jerusalem" }, async () => {
  const now = Date.now();
  const households = await db.collection("households").listDocuments();
  for (const h of households) {
    const tokens = await h.collection("pushTokens").get();
    if (tokens.empty) continue;
    const ref = h.collection("settings").doc("settings");
    const s = (await ref.get()).data() || {};
    // Never synced: measure from when notifications were first enabled.
    const since = s.lastCalendarSyncAt
      ? Date.parse(s.lastCalendarSyncAt)
      : Math.min(...tokens.docs.map((d) => Date.parse(d.get("createdAt")) || now));
    if (now - since < STALE_DAYS * DAY_MS) continue;
    if (s.lastSyncReminderAt && now - Date.parse(s.lastSyncReminderAt) < 20 * 60 * 60 * 1000) continue;
    await notifyOwner(h.id, {
      title: "תזכורת סנכרון יומן",
      body: "עבר יותר משבוע מאז הסנכרון האחרון של היומן.",
      tag: "calendar-reminder",
    });
    await ref.set({ lastSyncReminderAt: new Date(now).toISOString() }, { merge: true });
  }
});
