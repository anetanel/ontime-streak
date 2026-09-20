import { initializeApp } from "./vendor/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  signOut,
} from "./vendor/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "./vendor/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Keeps checkins/shifts/prizes readable and writable offline, syncing once
// the phone is back online — matching the offline behavior the app had
// with IndexedDB before this migration.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});

const googleProvider = new GoogleAuthProvider();

// A redirect (not a popup) is Firebase's own recommended flow for mobile —
// popups depend on window.open + postMessage back to an opener, which
// doesn't reliably exist inside an installed iOS Home Screen PWA. This
// navigates away to Google and back; getRedirectResult below picks up
// the result once the app reloads.
export function signInWithGoogle() {
  return signInWithRedirect(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

// Guests (invite-link access) never see a login screen — they get an
// invisible anonymous identity, same mechanism as before Google sign-in
// was added for the two admins.
export function signInAsGuest() {
  return signInAnonymously(auth);
}

getRedirectResult(auth).catch((err) => {
  console.error("Google sign-in redirect failed:", err);
});
