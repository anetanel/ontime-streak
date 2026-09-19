# On-Time Streak

A private, on-device iPhone habit tracker: tap "I'm at Work" when you arrive, build a streak of on-time days, and unlock photos of your favorite musicians as your streak grows. All data stays on your phone — nothing is ever sent to a server.

Live app: `https://anetanel.github.io/ontime-streak/`

## Installing on her iPhone (do this once)

1. Open the link above in **Safari** (must be Safari, not Chrome, for it to install like an app).
2. Let the page fully load once.
3. Tap the **Share** icon (square with an arrow) → scroll down → **Add to Home Screen** → **Add**.
4. A new icon appears on the Home Screen — tapping it opens the app full-screen, like any other app.

## Everyday use (no tech knowledge needed)

- **Home**: tap "I'm at Work" when you arrive. On time = confetti/fireworks. Late = a gentle reset message. If no shift was entered for today, checking in doesn't affect the streak either way.
- **Calendar** (also doubles as Shifts, since this is part-time work with no fixed weekly pattern): tap any future date (shown in light purple once it has a shift) to add or edit that day's shift start time, or tap a purple day again to change/remove it. Tap a past date to see what happened that day. A day with no shift entered isn't counted as a scheduled work day at all. Also shows streak stats, an on-time-percentage toggle, and an arrival-time trend chart.
- **Rewards**: tap "+ Add Reward" to upload a photo of a favorite musician and set how many days in a row unlocks it. Tap the pencil on any reward to edit or delete it. No code, ever — this screen is the entire way to customize rewards.
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
const CACHE_NAME = "ontime-streak-v14"; // increment this

// js/version.js
export const APP_VERSION = "14"; // ...and this, to the same number
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

### Local preview (desktop, for quick sanity checks only)

```bash
cd ontime-streak
python3 -m http.server 8000
# open http://localhost:8000 in a browser
```

Real installability, offline behavior, and safe-area layout can only be verified on an actual iPhone via the live GitHub Pages URL.

## Known limitations

- No reminder notifications — iOS Safari PWAs can't reliably send background push without a paid service. Use a regular iPhone alarm as the reminder to open the app.
- No cloud sync between devices. Moving to a new phone requires Export Backup on the old one and Import Backup on the new one.
- No backfilling a missed day — this keeps the streak meaningful, but means a forgotten check-in can't be corrected after the fact.
- Shifts need to be entered before the day happens — there's no automatic recurring pattern, since the work schedule is irregular. A shift added after the fact for a past date will still be picked up by the streak/history calculations, but won't retroactively help if a check-in was already missed.
- Relies on the iPhone's system clock for on-time/late calculation.
