# On-Time Streak

A private, on-device iPhone habit tracker: tap "I'm at Work" when you arrive, build a streak of on-time days, and unlock photos of your favorite musicians as your streak grows. All data stays on your phone — nothing is ever sent to a server.

Live app: `https://anetanel.github.io/ontime-streak/`

## Installing on her iPhone (do this once)

1. Open the link above in **Safari** (must be Safari, not Chrome, for it to install like an app).
2. Let the page fully load once.
3. Tap the **Share** icon (square with an arrow) → scroll down → **Add to Home Screen** → **Add**.
4. A new icon appears on the Home Screen — tapping it opens the app full-screen, like any other app.

## Everyday use (no tech knowledge needed)

- **Home**: tap "I'm at Work" when you arrive. On time = confetti/fireworks. Late = a gentle reset message.
- **History**: calendar of on-time/late days, streak stats, and an arrival-time trend chart.
- **Rewards**: tap "+ Add Reward" to upload a photo of a favorite musician and set how many days in a row unlocks it. Tap the pencil on any reward to edit or delete it. No code, ever — this screen is the entire way to customize rewards.
- **Settings**: change your expected start time, grace period, and which days you work. Also where you back up your data (Export Backup) — do this occasionally and save the file to Files/iCloud or AirDrop it to someone, so history survives a lost phone or a cleared browser.

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
const CACHE_NAME = "ontime-streak-v2"; // increment this
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
- Changing the weekly work schedule only affects streak calculations going forward, not past dates.
- Relies on the iPhone's system clock for on-time/late calculation.
