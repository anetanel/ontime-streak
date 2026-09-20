// Testing-only helpers, exposed as window.__test in the browser console.
// Never used by the real app UI — she will never see or need these.
//
// DANGER: since Google Sign-In was added, there's no more per-browser data
// isolation for admins — every admin-signed-in session (her phone, your
// laptop, anywhere) reads/writes the exact same shared Firestore household.
// Running these while signed in as an admin overwrites her real data.
// Export a backup first (Settings → Export Backup) if there's anything
// here worth keeping before running any of these.
import { App, refreshAll } from "./app.js";
import { formatLocalDate, getTierForStreak } from "./streak.js";
import { saveCheckin, saveShift, resetAllData } from "./db.js";
import { findMatchingTier, pickRandomPrize } from "./prizes.js";
import { showPrizeReveal } from "./ui-home.js";
import { celebrate } from "./confetti.js";

const CELEBRATION_TIERS = ["small", "medium", "large", "xlarge", "max"];

async function setStreak(days) {
  if (!Number.isInteger(days) || days < 0) {
    console.log("[test] Usage: __test.setStreak(5)");
    return;
  }
  await resetAllData();

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

  // Today's shift is ready but not checked in yet, so tapping "I'm at
  // Work" in the UI reaches day (days + 1) through the real flow.
  await saveShift({ date: formatLocalDate(today), startTime: "10:00" });
  await refreshAll();
  console.log(
    `[test] Streak set to ${days} (ending yesterday). Today has a 10:00 shift ready — ` +
      `tap "הגעתי לעבודה" on Home to check in and reach day ${days + 1}.`
  );
}

function previewPrize(streakDay) {
  const tier = findMatchingTier(streakDay);
  if (!tier) {
    console.log(`[test] Day ${streakDay} doesn't match any tier (3 / 7 / 30 / 180).`);
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
  console.log(`[test] Playing "${tier}" tier celebration${typeof tierOrStreak === "number" ? ` (streak day ${tierOrStreak})` : ""}.`);
  celebrate(canvas, tier, soundEnabled);
}

function previewAllCelebrations() {
  const gapMs = 4000; // generous fixed gap; the heavier tiers run up to ~6.5s themselves
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

window.__test = { setStreak, previewPrize, previewCelebration, previewAllCelebrations, reset };
console.log(
  "%cOn-Time Streak test tools (window.__test) — never run these while signed in as an admin against her real data:",
  "font-weight:bold",
  "\n  __test.setStreak(n)              wipes data and fakes an n-day streak ending yesterday",
  "\n  __test.previewPrize(n)           shows the reveal for whatever day n would award, without saving anything",
  '\n  __test.previewCelebration(n|"tier")  plays the confetti/fireworks for a streak day or an explicit tier name',
  "\n                                    tiers: " + CELEBRATION_TIERS.join(", "),
  "\n  __test.previewAllCelebrations()  plays all 5 tiers back to back",
  "\n  __test.reset()                   wipes all data"
);
