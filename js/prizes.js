import { parseLocalDate, computeStreak } from "./streak.js";
import { savePrizeAward, deletePrizeAward } from "./db.js";

// Ordered most to least significant, so the highest matching tier wins
// on a day that happens to divide evenly into more than one of these.
export const PRIZE_TIERS = [
  { key: "tier4", intervalDays: 180, label: "כל חצי שנה" },
  { key: "tier3", intervalDays: 30, label: "כל חודש" },
  { key: "tier2", intervalDays: 7, label: "כל שבוע" },
  { key: "tier1", intervalDays: 3, label: "כל 3 ימים" },
];

export function getTierByKey(key) {
  return PRIZE_TIERS.find((t) => t.key === key) || null;
}

let manifestPromise = null;

export function loadPrizeManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch("./prizes/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return manifestPromise;
}

export function findMatchingTier(streakDay) {
  if (!streakDay || streakDay < 1) return null;
  return PRIZE_TIERS.find((t) => streakDay % t.intervalDays === 0) || null;
}

export function pickRandomPrize(manifest, tierKey) {
  const pool = manifest && manifest[tierKey] && manifest[tierKey].prizes;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function daysUntilNextPrize(currentStreak) {
  for (let k = 1; k <= 180; k++) {
    const tier = findMatchingTier(currentStreak + k);
    if (tier) return { days: k, tier };
  }
  return null;
}

/**
 * Determines whether the streak as of dateStr hits a prize tier, and if
 * so records a randomly picked prize from that tier as awarded for that
 * date. If the date no longer qualifies (e.g. after editing a check-in),
 * any previously recorded award for it is removed instead.
 */
export async function evaluateAndAwardPrize(app, dateStr) {
  const streakDay = computeStreak(app.checkinsByDate, app.shiftsByDate, parseLocalDate(dateStr));
  const tier = findMatchingTier(streakDay);

  if (!tier) {
    await deletePrizeAward(dateStr);
    return null;
  }

  const prize = pickRandomPrize(app.prizeManifest, tier.key);
  if (!prize) {
    await deletePrizeAward(dateStr);
    return null;
  }

  const award = {
    date: dateStr,
    streakDay,
    tierKey: tier.key,
    prizeFile: prize.file,
    prizeTitle: prize.title,
    awardedAt: new Date().toISOString(),
  };
  await savePrizeAward(award);
  return award;
}
