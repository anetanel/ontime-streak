import { db } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  addDoc,
  writeBatch,
} from "./vendor/firebase-firestore.js";

const DATA_VERSION = 4; // bumped from 3 (IndexedDB) with the move to Firestore

// One shared household — access is controlled by Google account email via
// firestore.rules (see the isAdmin() check there), not by this path.
const ROOT = ["household", "main"];

function householdDoc(...segments) {
  return doc(db, ...ROOT, ...segments);
}

function householdCollection(name) {
  return collection(db, ...ROOT, name);
}

async function getAllDocs(collectionName) {
  const snap = await getDocs(householdCollection(collectionName));
  return snap.docs.map((d) => d.data());
}

// Firestore batches cap at 500 writes; personal shift/checkin history can
// exceed that after a couple of years, so writes here are chunked.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function clearCollection(collectionName) {
  const snap = await getDocs(householdCollection(collectionName));
  for (const group of chunk(snap.docs, 400)) {
    const batch = writeBatch(db);
    group.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function putAll(collectionName, records, idField) {
  for (const group of chunk(records, 400)) {
    const batch = writeBatch(db);
    group.forEach((rec) => batch.set(householdDoc(collectionName, rec[idField]), rec));
    await batch.commit();
  }
}

export const DEFAULT_SETTINGS = {
  id: "settings",
  graceMinutes: 5,
  soundEnabled: true,
  themePreference: "system",
  lastBackupAt: null,
  createdAt: new Date().toISOString(),
};

export async function getSettings() {
  const snap = await getDoc(householdDoc("settings", "settings"));
  return snap.exists() ? snap.data() : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings) {
  await setDoc(householdDoc("settings", "settings"), { ...settings, id: "settings" });
}

export async function getAllCheckins() {
  return getAllDocs("checkins");
}

export async function getCheckin(date) {
  const snap = await getDoc(householdDoc("checkins", date));
  return snap.exists() ? snap.data() : undefined;
}

export async function saveCheckin(record) {
  await setDoc(householdDoc("checkins", record.date), record);
}

export async function getAllPrizeAwards() {
  return getAllDocs("prizeAwards");
}

export async function savePrizeAward(award) {
  await setDoc(householdDoc("prizeAwards", award.date), award);
}

export async function deletePrizeAward(date) {
  await deleteDoc(householdDoc("prizeAwards", date));
}

export async function getAllShifts() {
  return getAllDocs("shifts");
}

export async function getShift(date) {
  const snap = await getDoc(householdDoc("shifts", date));
  return snap.exists() ? snap.data() : undefined;
}

export async function saveShift(shift) {
  await setDoc(householdDoc("shifts", shift.date), shift);
}

export async function deleteShift(date) {
  await deleteDoc(householdDoc("shifts", date));
}

export async function getStreakState() {
  const snap = await getDoc(householdDoc("meta", "streakState"));
  return snap.exists()
    ? snap.data()
    : { id: "streakState", currentStreak: 0, longestStreak: 0, lastComputedForDate: null };
}

export async function saveStreakState(state) {
  await setDoc(householdDoc("meta", "streakState"), { ...state, id: "streakState" });
}

export async function exportAllData() {
  const [settings, checkins, prizeAwards, shifts, streakState] = await Promise.all([
    getSettings(),
    getAllCheckins(),
    getAllPrizeAwards(),
    getAllShifts(),
    getStreakState(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: DATA_VERSION,
    settings,
    checkins,
    prizeAwards,
    shifts,
    streakState,
  };
}

export async function importAllData(data) {
  await setDoc(householdDoc("settings", "settings"), { ...data.settings, id: "settings" });

  await clearCollection("checkins");
  await putAll("checkins", data.checkins || [], "date");

  await clearCollection("prizeAwards");
  await putAll("prizeAwards", data.prizeAwards || [], "date");

  await clearCollection("shifts");
  await putAll("shifts", data.shifts || [], "date");

  await setDoc(householdDoc("meta", "streakState"), { ...(data.streakState || {}), id: "streakState" });
}

export async function resetAllData() {
  await deleteDoc(householdDoc("settings", "settings"));
  await deleteDoc(householdDoc("meta", "streakState"));
  await clearCollection("checkins");
  await clearCollection("prizeAwards");
  await clearCollection("shifts");
}

// --- Guest invite links (read + comment only, no login) ---
// invites/{inviteId} docs are created by hand in the Firebase console (see
// README) — there's no in-app "create invite" UI yet.

export async function getInvite(inviteId) {
  const snap = await getDoc(doc(db, "invites", inviteId));
  return snap.exists() ? snap.data() : null;
}

export async function getGuestGrant(uid) {
  const snap = await getDoc(doc(db, "guestGrants", uid));
  return snap.exists() ? snap.data() : null;
}

export async function redeemInvite(inviteId, uid, label) {
  await setDoc(doc(db, "guestGrants", uid), {
    invite: inviteId,
    label: label || "",
    grantedAt: new Date().toISOString(),
  });
}

export async function getAllComments() {
  const snap = await getDocs(householdCollection("comments"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addComment({ prizeAwardDate, authorUid, authorLabel, text }) {
  await addDoc(householdCollection("comments"), {
    prizeAwardDate,
    authorUid,
    authorLabel,
    text,
    createdAt: new Date().toISOString(),
  });
}
