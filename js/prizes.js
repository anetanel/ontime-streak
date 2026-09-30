import { parseLocalDate, computeStreak } from "./streak.js";
import { savePrizeAward, deletePrizeAward } from "./db.js";

// Ordered most to least significant, so the highest matching tier wins
// on a day that happens to divide evenly into more than one of these.
export const PRIZE_TIERS = [
  { key: "high", intervalDays: [30, 180], label: "פרס גדול" },
  { key: "low", intervalDays: [3, 7], label: "פרס רגיל" },
];

// Awards saved before the move to two tiers carry the old four keys.
const LEGACY_TIER_KEYS = { tier1: "low", tier2: "low", tier3: "high", tier4: "high" };

export function getTierByKey(key) {
  const k = LEGACY_TIER_KEYS[key] || key;
  return PRIZE_TIERS.find((t) => t.key === k) || null;
}

export function isHighAward(award) {
  const t = getTierByKey(award && award.tierKey);
  return !!t && t.key === "high";
}

// The streak an award was reached at, e.g. "63 ימים רצופים".
export function streakPeriodLabel(streakDay) {
  return streakDay === 180 ? "חצי שנה רצופה" : `${streakDay} ימים רצופים`;
}

// The milestone rule that triggered an award, e.g. day 63 -> "פרס על כל 7 ימים רצופים".
// When several intervals in the tier divide the day, the largest is stated (21 -> 7),
// except 180 which is always stated as the half-year milestone.
export function streakRuleLabel(streakDay) {
  const n = streakRuleInterval(streakDay);
  if (!n) return "";
  if (n === 180) return "פרס על כל חצי שנה רצופה";
  return `פרס על כל ${n} ימים רצופים`;
}

// The interval whose milestone an award hit, e.g. day 60 -> 30, day 63 -> 7, day 360 -> 180.
export function streakRuleInterval(streakDay) {
  const tier = findMatchingTier(streakDay);
  if (!tier) return 0;
  if (streakDay % 180 === 0) return 180;
  return Math.max(...tier.intervalDays.filter((d) => streakDay % d === 0));
}

// "7 ימים רצופים" / "חצי שנה רצופה" for the milestone an award hit.
export function milestoneLabel(streakDay) {
  return streakPeriodLabel(streakRuleInterval(streakDay));
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
  return PRIZE_TIERS.find((t) => t.intervalDays.some((n) => streakDay % n === 0)) || null;
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
