import { initializeApp } from "./vendor/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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

// signInWithRedirect was tried first (it's Firebase's usual recommendation
// for mobile), but its redirect-result handshake relies on a hidden iframe
// on the authDomain talking back via postMessage — a third-party context
// that Safari's Intelligent Tracking Prevention silently blocks from
// storage access, breaking it with no catchable error, in both regular
// Safari and an installed Home Screen PWA (confirmed in the field on both).
// A popup is a real top-level window, not a third-party iframe, so it
// doesn't hit that restriction — and since it's opened directly from a
// button tap (a real user gesture), Safari won't block it as a popup.
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
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
