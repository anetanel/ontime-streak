import { auth, db } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  writeBatch,
} from "./vendor/firebase-firestore.js";

const DATA_VERSION = 4; // bumped from 3 (IndexedDB) with the move to Firestore

// Each admin (her, you) gets their own household keyed by their own Google
// uid — see firestore.rules. This is what keeps your test data completely
// separate from her real one.
function myHouseholdId() {
  return auth.currentUser.uid;
}

function householdDoc(householdId, ...segments) {
  return doc(db, "households", householdId, ...segments);
}

function householdCollection(householdId, name) {
  return collection(db, "households", householdId, name);
}

async function getAllDocs(householdId, collectionName) {
  const snap = await getDocs(householdCollection(householdId, collectionName));
  return snap.docs.map((d) => d.data());
}

// Firestore batches cap at 500 writes; personal shift/checkin history can
// exceed that after a couple of years, so writes here are chunked.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function clearCollection(householdId, collectionName) {
  const snap = await getDocs(householdCollection(householdId, collectionName));
  for (const group of chunk(snap.docs, 400)) {
    const batch = writeBatch(db);
    group.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function putAll(householdId, collectionName, records, idField) {
  for (const group of chunk(records, 400)) {
    const batch = writeBatch(db);
    group.forEach((rec) => batch.set(householdDoc(householdId, collectionName, rec[idField]), rec));
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
  const snap = await getDoc(householdDoc(myHouseholdId(), "settings", "settings"));
  return snap.exists() ? snap.data() : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings) {
  await setDoc(householdDoc(myHouseholdId(), "settings", "settings"), { ...settings, id: "settings" });
}

export async function getAllCheckins() {
  return getAllDocs(myHouseholdId(), "checkins");
}

export async function getCheckin(date) {
  const snap = await getDoc(householdDoc(myHouseholdId(), "checkins", date));
  return snap.exists() ? snap.data() : undefined;
}

export async function saveCheckin(record) {
  await setDoc(householdDoc(myHouseholdId(), "checkins", record.date), record);
}

export async function getAllPrizeAwards() {
  return getAllDocs(myHouseholdId(), "prizeAwards");
}

export async function getMyComments() {
  const snap = await getDocs(householdCollection(myHouseholdId(), "comments"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteMyComment(commentId) {
  await deleteDoc(householdDoc(myHouseholdId(), "comments", commentId));
}

export async function savePrizeAward(award) {
  await setDoc(householdDoc(myHouseholdId(), "prizeAwards", award.date), award);
}

export async function deletePrizeAward(date) {
  await deleteDoc(householdDoc(myHouseholdId(), "prizeAwards", date));
}

export async function getAllShifts() {
  return getAllDocs(myHouseholdId(), "shifts");
}

export async function getShift(date) {
  const snap = await getDoc(householdDoc(myHouseholdId(), "shifts", date));
  return snap.exists() ? snap.data() : undefined;
}

export async function saveShift(shift) {
  await setDoc(householdDoc(myHouseholdId(), "shifts", shift.date), shift);
}

export async function deleteShift(date) {
  await deleteDoc(householdDoc(myHouseholdId(), "shifts", date));
}

export async function getStreakState() {
  const snap = await getDoc(householdDoc(myHouseholdId(), "meta", "streakState"));
  return snap.exists()
    ? snap.data()
    : { id: "streakState", currentStreak: 0, longestStreak: 0, lastComputedForDate: null };
}

export async function saveStreakState(state) {
  await setDoc(householdDoc(myHouseholdId(), "meta", "streakState"), { ...state, id: "streakState" });
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
  const householdId = myHouseholdId();
  await setDoc(householdDoc(householdId, "settings", "settings"), { ...data.settings, id: "settings" });

  await clearCollection(householdId, "checkins");
  await putAll(householdId, "checkins", data.checkins || [], "date");

  await clearCollection(householdId, "prizeAwards");
  await putAll(householdId, "prizeAwards", data.prizeAwards || [], "date");

  await clearCollection(householdId, "shifts");
  await putAll(householdId, "shifts", data.shifts || [], "date");

  await setDoc(householdDoc(householdId, "meta", "streakState"), { ...(data.streakState || {}), id: "streakState" });
}

export async function resetAllData() {
  const householdId = myHouseholdId();
  await deleteDoc(householdDoc(householdId, "settings", "settings"));
  await deleteDoc(householdDoc(householdId, "meta", "streakState"));
  await clearCollection(householdId, "checkins");
  await clearCollection(householdId, "prizeAwards");
  await clearCollection(householdId, "shifts");
}

// --- Guest invite links (read + comment only, no login) ---
// invites/{inviteId} docs are created by hand in the Firebase console (see
// README) — there's no in-app "create invite" UI yet. Each invite names
// which admin's household (by uid, in its ownerId field) it grants access to.

export async function getInvite(inviteId) {
  const snap = await getDoc(doc(db, "invites", inviteId));
  return snap.exists() ? snap.data() : null;
}

export async function getGuestGrant(uid) {
  const snap = await getDoc(doc(db, "guestGrants", uid));
  return snap.exists() ? snap.data() : null;
}

export async function redeemInvite(inviteId, uid, label, householdId) {
  await setDoc(doc(db, "guestGrants", uid), {
    invite: inviteId,
    householdId,
    label: label || "",
    grantedAt: new Date().toISOString(),
  });
}

// --- Guest-facing reads: an explicit household, not "my own" ---

export async function getPrizeAwardsForHousehold(householdId) {
  return getAllDocs(householdId, "prizeAwards");
}

export async function getCommentsForHousehold(householdId) {
  const snap = await getDocs(householdCollection(householdId, "comments"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addCommentToHousehold({ householdId, prizeAwardDate, authorUid, authorLabel, text }) {
  await addDoc(householdCollection(householdId, "comments"), {
    prizeAwardDate,
    authorUid,
    authorLabel,
    text,
    createdAt: new Date().toISOString(),
  });
}

// --- Invite management (admin-facing, for the "Manage Invites" screen) ---

export async function getMyInvites() {
  const q = query(collection(db, "invites"), where("ownerId", "==", myHouseholdId()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createInvite(label) {
  const owner = auth.currentUser;
  const ref = await addDoc(collection(db, "invites"), {
    label: label || "",
    active: true,
    ownerId: myHouseholdId(),
    ownerName: owner.displayName || owner.email || "",
    ownerPhotoURL: owner.photoURL || null,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function setInviteActive(inviteId, active) {
  await updateDoc(doc(db, "invites", inviteId), { active });
}

export async function deleteInvite(inviteId) {
  await deleteDoc(doc(db, "invites", inviteId));
}
