// Values from Firebase Console → Project settings → Your apps → (web app) → SDK setup and configuration.
// These identify the project; they are not secrets — access is controlled by firestore.rules, not by hiding this file.
export const firebaseConfig = {
  apiKey: "AIzaSyDdGZmJNAu-4vHJSgXMLcvVStlhd8VKR0k",
  authDomain: "ontime-streak.firebaseapp.com",
  projectId: "ontime-streak",
  storageBucket: "ontime-streak.firebasestorage.app",
  messagingSenderId: "513765829256",
  appId: "1:513765829256:web:d2a4e821740dc076e94d3d",
};

// Google accounts allowed to sign in as the app's two admins (full
// read/write). This list is a UX convenience only (so an unauthorized
// Google account gets a clear message instead of a silent Firestore
// failure) — the real enforcement is the matching allowlist in
// firestore.rules, which is what actually protects the data.
export const ADMIN_EMAILS = [
  "netanel.attali@gmail.com",
  "dovnemalim@gmail.com",
];
