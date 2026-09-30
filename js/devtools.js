// Testing-only helpers, exposed as window.__test in the browser console.
// Never used by the real app UI — she will never see or need these.
//
// Each admin's data lives in their own Firestore household, keyed by their
// own Google uid (see firestore.rules) — so these only ever touch whichever
// admin account is currently signed in on this browser. Just make sure
// you're signed in as yourself, not her, before running any of these.
import { App, refreshAll } from "./app.js";
import { formatLocalDate, getTierForStreak } from "./streak.js";
import { saveCheckin, saveShift, deleteCheckin, getAllPrizeAwards, savePrizeAward, deletePrizeAward, resetAllData } from "./db.js";
import { findMatchingTier, pickRandomPrize } from "./prizes.js";
import { showPrizeReveal } from "./ui-home.js";
import { celebrate } from "./confetti.js";

const CELEBRATION_TIERS = ["small", "medium", "large", "xlarge", "max"];

async function setStreak(days, { keep = false } = {}) {
  if (!Number.isInteger(days) || days < 0) {
    console.log("[test] Usage: __test.setStreak(5) or __test.extendStreak(7)");
    return;
  }
  if (!keep) await resetAllData();

  const today = new Date();
  for (let i = days; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatLocalDate(d);
    await saveShift({ date: dateStr, startTime: "10:00" });
    await saveCheckin({
      date: dateStr,
      timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0, 0).toISOString(),
      status: "on-time",
      minutesLate: 0,
    });
  }

  if (keep) {
    // Re-arm today so it can be checked in again; earlier prize awards stay.
    const todayStr = formatLocalDate(today);
    await deleteCheckin(todayStr);
    // Awards are keyed by date and every test check-in lands on today, so
    // move today's award to a free past date instead of losing it.
    const awards = await getAllPrizeAwards();
    const todays = awards.find((a) => a.date === todayStr);
    if (todays) {
      // The list sorts by date, newest first, so each archived award goes
      // one day after the latest past one to keep test order (3, 7, 30...).
      const past = awards.map((a) => a.date).filter((x) => x < todayStr).sort();
      const d = new Date(today);
      if (past.length) {
        const [y, m, dd] = past[past.length - 1].split("-").map(Number);
        d.setFullYear(y, m - 1, dd + 1);
      } else {
        d.setDate(d.getDate() - 365);
      }
      if (formatLocalDate(d) >= todayStr) {
        console.log("[test] No free past date left to archive the previous prize; it will be overwritten.");
      }
      await savePrizeAward({ ...todays, date: formatLocalDate(d) });
      await deletePrizeAward(todayStr);
    }
  }

  // Today's shift is ready but not checked in yet, so tapping "I'm at
  // Work" in the UI reaches day (days + 1) through the real flow.
  // Starts 30 minutes from now so checking in right away counts as on time.
  const start = new Date(today.getTime() + 30 * 60000);
  const startTime =
    formatLocalDate(start) === formatLocalDate(today)
      ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
      : "23:59"; // would roll past midnight
  await saveShift({ date: formatLocalDate(today), startTime });
  await refreshAll();
  console.log(
    `[test] Streak set to ${days} (ending yesterday). Today has a ${startTime} shift ready — ` +
      `tap "הגעתי לעבודה" on Home to check in and reach day ${days + 1}.`
  );
}

// Like setStreak, but wipes nothing: it only (over)writes the `days` days
// before today as on-time and re-arms today, so earlier data and prize
// awards survive. Call extendStreak(3), check in, then extendStreak(7), etc.
function extendStreak(days) {
  return setStreak(days, { keep: true });
}

function previewPrize(streakDay) {
  const tier = findMatchingTier(streakDay);
  if (!tier) {
    console.log(`[test] Day ${streakDay} doesn't match any tier (low: 3 / 7, high: 30 / 180).`);
    return;
  }
  const prize = pickRandomPrize(App.prizeManifest, tier.key);
  if (!prize) {
    console.log(`[test] Day ${streakDay} matches ${tier.key} (${tier.label}), but that tier has no prizes in the manifest.`);
    return;
  }
  console.log(`[test] Day ${streakDay} -> ${tier.label}: "${prize.title}" (${prize.file})`);
  showPrizeReveal({ tierKey: tier.key, prizeFile: prize.file, prizeTitle: prize.title, streakDay });
}

// Browsers keep audio muted until the page itself (not the devtools console) has been clicked or tapped.
function warnIfSoundBlocked(soundEnabled) {
  if (!soundEnabled) {
    console.log("[test] Sound is turned off in settings, so this preview will be silent.");
  } else if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    console.log("[test] No sound: click anywhere on the page first (the browser blocks audio until you do), then run this again.");
  }
}

function previewCelebration(tierOrStreak) {
  let tier;
  if (typeof tierOrStreak === "string") {
    if (!CELEBRATION_TIERS.includes(tierOrStreak)) {
      console.log(`[test] Unknown tier "${tierOrStreak}". Use one of: ${CELEBRATION_TIERS.join(", ")}, or pass a streak number instead.`);
      return;
    }
    tier = tierOrStreak;
  } else if (Number.isInteger(tierOrStreak) && tierOrStreak >= 1) {
    tier = getTierForStreak(tierOrStreak);
  } else {
    console.log('[test] Usage: __test.previewCelebration(45) or __test.previewCelebration("large")');
    return;
  }

  const canvas = document.getElementById("celebration-canvas");
  const soundEnabled = App.settings ? App.settings.soundEnabled : true;
  warnIfSoundBlocked(soundEnabled);
  console.log(`[test] Playing "${tier}" tier celebration${typeof tierOrStreak === "number" ? ` (streak day ${tierOrStreak})` : ""}.`);
  celebrate(canvas, tier, soundEnabled);
}

function previewAllCelebrations() {
  const gapMs = 4000;
  warnIfSoundBlocked(App.settings ? App.settings.soundEnabled : true); // generous fixed gap; the heavier tiers run up to ~6.5s themselves
  CELEBRATION_TIERS.forEach((tier, i) => {
    setTimeout(() => previewCelebration(tier), i * gapMs);
  });
  console.log(`[test] Playing all tiers back to back, ${gapMs / 1000}s apart: ${CELEBRATION_TIERS.join(" -> ")}`);
}

async function reset() {
  await resetAllData();
  await refreshAll();
  console.log("[test] All data wiped.");
}

window.__test = { setStreak, extendStreak, previewPrize, previewCelebration, previewAllCelebrations, reset };
console.log(
  "%cOn-Time Streak test tools (window.__test) — these touch whichever admin account is signed in on this browser, so make sure that's you, not her:",
  "font-weight:bold",
  "\n  __test.setStreak(n)              wipes data and fakes an n-day streak ending yesterday",
  "\n  __test.extendStreak(n)          like setStreak but keeps all data/prizes; use to step 3 -> 7 -> 30",
  "\n  __test.previewPrize(n)           shows the reveal for whatever day n would award, without saving anything",
  '\n  __test.previewCelebration(n|"tier")  plays the confetti/fireworks for a streak day or an explicit tier name',
  "\n                                    tiers: " + CELEBRATION_TIERS.join(", "),
  "\n  __test.previewAllCelebrations()  plays all 5 tiers back to back",
  "\n  __test.reset()                   wipes all data"
);
