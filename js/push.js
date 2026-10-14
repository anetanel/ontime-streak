import { getMessaging, getToken, deleteToken, isSupported } from "./vendor/firebase-messaging.js";
import { doc, setDoc, deleteDoc } from "./vendor/firebase-firestore.js";
import { app, db } from "./firebase-init.js";
import { VAPID_KEY } from "./firebase-config.js";
import { myHouseholdId } from "./db.js";

const TOKEN_KEY = "pushToken";

// iOS only delivers web push to a Home Screen install (16.4+), and only
// once the user has granted permission from a tap.
export async function pushSupported() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

export function pushEnabled() {
  return Notification.permission === "granted" && !!localStorage.getItem(TOKEN_KEY);
}

function tokenDoc(token) {
  return doc(db, "households", myHouseholdId(), "pushTokens", token);
}

export async function enablePush() {
  return registerToken(tokenDoc, {});
}

export async function disablePush() {
  return unregisterToken(tokenDoc);
}

// Guests register under the household they were invited to, tagged with
// their uid so the rules (and the server, for revoked grants) can tell whose it is.
export function enableGuestPush(householdId, uid) {
  return registerToken((token) => doc(db, "households", householdId, "guestPushTokens", token), { uid });
}

export function disableGuestPush(householdId) {
  return unregisterToken((token) => doc(db, "households", householdId, "guestPushTokens", token));
}

async function registerToken(refFor, extra) {
  if ((await Notification.requestPermission()) !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return false;
  await setDoc(refFor(token), { ...extra, createdAt: new Date().toISOString(), ua: navigator.userAgent });
  localStorage.setItem(TOKEN_KEY, token);
  return true;
}

async function unregisterToken(refFor) {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  if (token) await deleteDoc(refFor(token)).catch(() => {});
  await deleteToken(getMessaging(app)).catch(() => {});
}
