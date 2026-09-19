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
- **Shifts**: since this is part-time, shift-based work, there's no fixed weekly pattern — tap "+ Add Shift" to enter each upcoming work day's date and start time. A day with no shift entered isn't counted as a scheduled work day at all.
- **History**: calendar of on-time/late/missed/no-shift days, streak stats, and an arrival-time trend chart.
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

**Important:** whenever you change any file that the app loads (HTML/CSS/JS/icons), bump the cache name in `sw.js`:

```js
const CACHE_NAME = "ontime-streak-v3"; // increment this
```

This is what makes her already-installed app fetch the new version next time she opens it with an internet connection — otherwise the service worker keeps serving the old cached files indefinitely.

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
