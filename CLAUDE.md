# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Hebrew/RTL iPhone PWA habit tracker ("On-Time Streak"): tap "I'm at Work", build a streak of on-time days, win random prize photos at streak milestones (3/7/30/180 days). Plain HTML/CSS/ES-module JS — **no build step, no npm, no test suite, no linter**. Deployed by pushing `main` to GitHub Pages. `README.md` has extensive operational detail (iOS update quirks, Firebase setup); read it before touching auth, deploy, or service-worker behavior.

## Commands

- Run locally: `python3 -m http.server 8000` → http://localhost:8000 (localhost counts as a secure context, so the service worker works). Use DevTools → Network → "Disable cache" or an incognito window, since the service worker is cache-first and serves stale files.
- Deploy app: commit and push to `main`.
- Deploy Firestore rules: `firebase deploy --only firestore:rules` (CLI at `~/tools/firebase-cli/firebase`; `.firebaserc` points at the `ontime-streak` project). A rules edit without a deploy fails closed.
- Manual testing helpers live on `window.__test` (`js/devtools.js`): `setStreak(n)`, `previewPrize(day)`, `previewCelebration(n|tier)`, `previewAllCelebrations()`, `reset()`. `setStreak`/`reset` **wipe the signed-in admin's real Firestore household** — never run them signed in as her.

## Mandatory on every change to loaded files

Bump `CACHE_NAME` in `sw.js` (`ontime-streak-vN`) **and** `APP_VERSION` in `js/version.js` to the same number N, and set `APP_BUILD_TIME` (same file) to the current local date and time (`date '+%Y-%m-%d %H:%M'`). Otherwise installed apps keep serving the old cache. Also add any new file the app loads to the `ASSETS` list in `sw.js` (it is precached explicitly, including prize images).

## Architecture

- **Entry/state**: `js/app.js` exports the singleton `App` (settings, checkins/shifts/prizeAwards plus `Map`s by date, prize manifest, current/longest streak) and `loadAll`/`refreshAll`. UI modules (`ui-home`, `ui-history` = calendar/shifts, `ui-prizes`, `ui-settings`, `ui-invites`) each expose `initX`/`renderX` and read from `App`. `index.html` is a single page with all screens.
- **Streak logic** (`js/streak.js`): pure functions. A day is scheduled iff a shift exists for it. On-time means exactly on time (no grace period). Late reason `"unforeseen"` ("special circumstances") is a one-time pass per streak run; `scanStreaks` scans forward chronologically so the first such day in a run is the one that uses the pass.
- **Data layer** (`js/db.js`): all Firestore access. Data lives under `households/{admin Google uid}/...`, so each admin (`ADMIN_EMAILS` in `js/firebase-config.js`) has an isolated household. Writes are chunked (<500 per batch).
- **Auth roles** (`js/auth-gate.js`, `js/firebase-init.js`, `firestore.rules` is the sole access control):
  - *Admins*: Google sign-in via `signInWithPopup`. Do **not** switch to `signInWithRedirect` — Safari ITP breaks it.
  - *Guests*: open `?invite=<id>`, get anonymous Firebase auth, and see only one household's prize achievements (`js/guest-view.js`), able to write only comments. An invite names one `ownerId`; redemption creates a `guestGrants` doc that is independent of the invite — only the per-guest revoke (🚫) cuts off an already-connected guest, not deactivating/deleting the invite.
- **Firebase SDK is vendored** in `js/vendor/` (relative import patched from the gstatic URL) so the service worker can cache it for offline use. Upgrade by re-downloading and re-applying that patch.
- **Prizes**: the catalog is `prizes/manifest.json` + `prizes/{low,high}/*.jpg` (low = 3/7-day streaks, high = 30/180; legacy `tier1-4` award keys map to these in `getTierByKey`), managed in-repo (see `prizes/README.md`), not in the app. `js/prizes.js` picks randomly within the matched tier; awards are stored permanently in Firestore.
- **Confetti** (`js/confetti.js`): five celebration tiers (small…max) driven by streak length.
