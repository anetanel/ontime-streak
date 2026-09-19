# On-Time Streak

A private, on-device iPhone habit tracker: tap "I'm at Work" when you arrive, build a streak of on-time days, and win a randomly picked musician photo every 3 days, 7 days, 30 days, and 6 months. All data stays on your phone — nothing is ever sent to a server. The prize photos themselves live in this repo (see `prizes/README.md`) and are curated by whoever maintains the code — she never has to enter or manage them.

Live app: `https://anetanel.github.io/ontime-streak/`

## Installing on her iPhone (do this once)

1. Open the link above in **Safari** (must be Safari, not Chrome, for it to install like an app).
2. Let the page fully load once.
3. Tap the **Share** icon (square with an arrow) → scroll down → **Add to Home Screen** → **Add**.
4. A new icon appears on the Home Screen — tapping it opens the app full-screen, like any other app.

## Everyday use (no tech knowledge needed)

- **Home**: tap "I'm at Work" when you arrive. On time turns the button into a gold star with confetti/fireworks. Late asks why — old habits, special circumstances, or "I actually arrived on time, I just tapped late" (which reopens the arrival-time entry so she can correct the actual time instead of picking a reason) — then shows a gentle message. If no shift was entered for today, the button is grayed out and disabled — there's nothing to check in against.
- **Calendar** (also doubles as Shifts, since this is part-time work with no fixed weekly pattern): tap any future date (shown in light purple once it has a shift) to add or edit that day's shift start time, or tap a purple day again to change/remove it. On-time days get a small gold star badge, "old habits" late days get a ❌, and "special circumstances" late days get a 😢. Tap a past date with a shift and no recorded arrival to enter what time she actually got there — same late-reason prompt as above. Tap a past date that already has a recorded arrival to see it, with an edit option to correct it. Also shows streak stats and an on-time-percentage toggle.
- **Late reasons and the streak**: "old habits" always breaks the streak, same as before. "Special circumstances" is a one-time pass **per streak period** — the first time it's used since the streak last actually broke, that late day doesn't break it; a second use before the next real break does break it, and the app tells her upfront (in the reason prompt) whether the pass is still available before she picks it.
- **Prizes**: fully read-only for her — shows how many days until the next prize, the four tiers (every 3 / 7 / 30 / 180 days), and a permanent history of every prize she's won, with the photo, title, tier, and date. The prize photo pool itself is managed in the repo, not the app — see `prizes/README.md`.
- **Settings**: grace period (how many minutes late still counts as on time), celebration sound, and where you back up your data (Export Backup) — do this occasionally and save the file to Files/iCloud or AirDrop it to someone, so history survives a lost phone or a cleared browser.

## For the developer (redeploying changes)

No build step — plain HTML/CSS/JS served as-is.

```bash
# make your edits, then:
git add -A
git commit -m "describe the change"
git push
```

GitHub Pages redeploys automatically within a minute or two of a push to `main`.

**Important:** whenever you change any file that the app loads (HTML/CSS/JS/icons), bump the cache name in `sw.js` **and** the matching number in `js/version.js`, keeping them the same number:

```js
// sw.js
const CACHE_NAME = "ontime-streak-v21"; // increment this

// js/version.js
export const APP_VERSION = "21"; // ...and this, to the same number
```

Bumping `CACHE_NAME` is what makes her already-installed app fetch the new version next time she opens it with an internet connection — otherwise the service worker keeps serving the old cached files indefinitely. `APP_VERSION` shows up at the bottom of the Settings screen in the app, so you can ask her what number she sees to confirm she's on the version you just shipped, without needing to describe UI changes over text.

**If she reopens the app and the version number hasn't changed:** as of v10, `app.js` explicitly forces a service-worker update check on load and whenever the app is foregrounded, and auto-reloads the moment a new version takes over — this should handle ordinary updates on its own most of the time, without any manual step.

**The Home Screen icon specifically is less reliable than a Safari tab.** Confirmed in the field: Safari picked up a new version correctly while the installed icon stayed on an older one at the same time. iOS runs the Home Screen icon as its own standalone process that can stay suspended across "closes," and that seems to make even the automatic update check unreliable there — this looks like a platform limitation, not something fully fixable from JS. As of v13, there's a manual escape hatch for exactly this: **open the app → Settings → "בדיקת עדכון"** (Check for Update), tap it, and if a new version is found the app reloads itself within a second or two. Try this first whenever the icon seems stuck.

If the manual check button itself is what's out of date (i.e. the icon is stuck on a build from before v13), that's a one-time bootstrapping problem — the old code has no way to know a newer check mechanism exists. In order of how targeted/non-destructive they are:
1. Open the live URL in a **new** Safari tab (tap the tabs button → **+**), not by switching back to an already-open tab — Safari can show an already-open tab exactly as last rendered without re-fetching anything.
2. If that still shows the old version: **Safari → Settings → Clear History for Today** (Safari app → the book icon → History → "Clear" at the bottom, choosing "Today"). This is what actually fixed it once before — Safari's history-based page cache is separate from "Website Data" (cookies/storage) and isn't touched by clearing that.
3. If the Home Screen icon specifically is still stuck after Safari itself is confirmed up to date: delete the icon and re-add it fresh from the now-updated Safari tab.
4. Only if that still doesn't work: have her tap **Export Backup** in Settings first, then **iPhone Settings → Safari → Advanced → Website Data**, find the site, delete its data (wipes the service worker/cache but also her on-device history — restore with **Import Backup** afterward).
5. Last resort: restart the phone.

### Local preview and testing (desktop)

```bash
cd ontime-streak
python3 -m http.server 8000
# open http://localhost:8000 in a regular desktop browser (Chrome/Firefox)
```

This is enough to exercise the real app logic end-to-end — IndexedDB, the service worker, and the streak/prize calculations all work the same as on the phone (`localhost` counts as a secure context, so the service worker registers normally). Only installability, offline app-switching behavior, and iOS-specific safe-area/viewport quirks can't be verified this way and need an actual iPhone via the live GitHub Pages URL.

**While iterating locally**, the service worker's cache-first strategy means it'll happily keep serving a stale copy of a file you just edited. Keep the browser's DevTools open with Network → "Disable cache" checked, or just use a private/incognito window, so every reload picks up your latest changes.

**Testing the prize/confetti system without waiting real days:** open the browser console and use `window.__test`, defined in `js/devtools.js` (never exposed anywhere she'd stumble into it, but also never hidden — it's plain code, not a security boundary):

```js
__test.setStreak(6)                 // wipes local data and fakes a 6-day streak ending yesterday,
                                     // with today's shift ready so tapping "הגעתי לעבודה" reaches day 7
__test.previewPrize(30)             // shows the actual reveal modal for whatever day 30 would award,
                                     // picked from the real manifest, without saving or touching any data
__test.previewCelebration(45)       // plays the confetti/fireworks tier a 45-day streak would trigger
__test.previewCelebration("max")    // or name a tier directly: small, medium, fireworks, bigFireworks, max
__test.previewAllCelebrations()     // plays all 5 tiers back to back, a few seconds apart
__test.reset()                      // wipes all local data back to empty
```

`previewCelebration`/`previewAllCelebrations` just call the real confetti engine directly — nothing is saved, so they're safe to run anytime, including on her real phone if you ever wanted to show her what a tier looks like without touching her data.

These are destructive to whatever's in local storage — only run them against the local dev server or a throwaway browser profile, never against her real installed app.

## Known limitations

- No reminder notifications — iOS Safari PWAs can't reliably send background push without a paid service. Use a regular iPhone alarm as the reminder to open the app.
- No cloud sync between devices. Moving to a new phone requires Export Backup on the old one and Import Backup on the new one.
- Backfilling only works for a date that already has a shift entered for it — there's still no way to retroactively add both a shift and an arrival time for a day nothing was ever scheduled on.
- Shifts need to be entered before the day happens — there's no automatic recurring pattern, since the work schedule is irregular. A shift added after the fact for a past date will still be picked up by the streak/history calculations, but won't retroactively help if a check-in was already missed.
- Relies on the iPhone's system clock for on-time/late calculation.
