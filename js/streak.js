export function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * shiftsByDate: Map<dateStr, shiftRecord> — a day is a scheduled work day
 * if and only if a shift has been entered for it.
 */
export function isScheduledDay(dateStr, shiftsByDate) {
  return shiftsByDate.has(dateStr);
}

/** Rounds an "HH:mm" string to the nearest 5-minute option. */
export function snapToTimeOptions(startTime) {
  let [h, m] = startTime.split(":").map(Number);
  m = Math.round(m / 5) * 5;
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  return { hour: String(h).padStart(2, "0"), minute: String(m).padStart(2, "0") };
}

export function computeCheckinResult(now, shift) {
  const dateStr = formatLocalDate(now);
  const [h, m] = shift.startTime.split(":").map(Number);
  const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const isLate = now.getTime() > deadline.getTime();
  const minutesLate = isLate ? Math.round((now.getTime() - deadline.getTime()) / 60000) : 0;
  return {
    date: dateStr,
    timestamp: now.toISOString(),
    status: isLate ? "late" : "on-time",
    minutesLate,
  };
}

/**
 * Scans forward chronologically from the earliest check-in through
 * `today`, tracking the run ending at today (the current streak) and the
 * best run seen anywhere (the longest streak) in a single pass. A late
 * day whose lateReason is "unforeseen" doesn't break the run, but only
 * once per run — scanning forward (not backward) is what makes "once per
 * run" mean the chronologically *first* such day within it, matching
 * isLateExemptionAvailable's notion of which one actually used the pass.
 */
function scanStreaks(checkinsByDate, shiftsByDate, today, maxDays, endDate = today) {
  const todayStr = formatLocalDate(today);
  const endStr = formatLocalDate(endDate);
  const dates = Array.from(checkinsByDate.keys()).sort();
  const earliestStr = dates.length && dates[0] < endStr ? dates[0] : endStr;

  let run = 0;
  let longest = 0;
  let exemptionUsed = false;
  const cursor = parseLocalDate(earliestStr);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  for (let i = 0; i < maxDays && cursor.getTime() <= end.getTime(); i++) {
    const dateStr = formatLocalDate(cursor);
    const isToday = dateStr === todayStr;

    if (isScheduledDay(dateStr, shiftsByDate)) {
      const rec = checkinsByDate.get(dateStr);
      if (rec && rec.status === "on-time") {
        run += 1;
        longest = Math.max(longest, run);
      } else if (rec && rec.status === "late" && rec.lateReason === "unforeseen" && !exemptionUsed) {
        exemptionUsed = true;
      } else if (rec && rec.status === "late") {
        run = 0;
        exemptionUsed = false;
      } else if (!rec && !isToday) {
        run = 0;
        exemptionUsed = false;
      }
      // a missing record for today just hasn't happened yet — leave run alone
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return { current: run, longest, exemptionUsed };
}

/**
 * checkinsByDate: Map<dateStr, checkinRecord>
 * shiftsByDate: Map<dateStr, shiftRecord>
 */
export function computeStreak(checkinsByDate, shiftsByDate, today = new Date(), maxDays = 3650) {
  return scanStreaks(checkinsByDate, shiftsByDate, today, maxDays).current;
}

export function computeLongestStreak(checkinsByDate, shiftsByDate, today = new Date(), maxDays = 3650) {
  return scanStreaks(checkinsByDate, shiftsByDate, today, maxDays).longest;
}

/**
 * Whether a late check-in on dateStr would still be exempted from
 * breaking the streak, i.e. the "unforeseen" pass hasn't been used in the
 * run ending the day before dateStr. Reuses the forward scan so it agrees
 * with computeStreak, including when an earlier "unforeseen" day was itself
 * a run-breaker (a second use) and so a fresh pass is available again.
 */
export function isLateExemptionAvailable(checkinsByDate, shiftsByDate, dateStr) {
  const dayBefore = parseLocalDate(dateStr);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return !scanStreaks(checkinsByDate, shiftsByDate, new Date(), 3650, dayBefore).exemptionUsed;
}

/**
 * Share of scheduled days (up to today) that were on time. range is
 * "week" (last 7 days), "month" (this calendar month) or "all" (since the
 * first check-in). Today only counts once it has a check-in.
 * Returns { pct, label } where pct is a rounded number or null if no data.
 */
export function onTimePercent(checkinsByDate, shiftsByDate, range, now = new Date()) {
  const todayStr = formatLocalDate(now);
  let start;
  let label;

  if (range === "week") {
    start = new Date(now); start.setDate(start.getDate() - 6);
    label = "אחוז בזמן (7 ימים)";
  } else if (range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "אחוז בזמן (חודש)";
  } else {
    const dates = Array.from(checkinsByDate.keys()).sort();
    start = dates.length ? parseLocalDate(dates[0]) : new Date(now);
    label = "אחוז בזמן (מאז ומתמיד)";
  }

  let onTime = 0;
  let total = 0;
  const cursor = new Date(start);
  while (formatLocalDate(cursor) <= todayStr) {
    const dateStr = formatLocalDate(cursor);
    if (isScheduledDay(dateStr, shiftsByDate)) {
      const rec = checkinsByDate.get(dateStr);
      if (rec) {
        total += 1;
        if (rec.status === "on-time") onTime += 1;
      } else if (dateStr !== todayStr) {
        total += 1;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { pct: total > 0 ? Math.round((onTime / total) * 100) : null, label };
}

// Ascending; `min` is the streak length at which the tier's star is earned.
export const CELEBRATION_TIERS = [
  { key: "small", min: 1 },
  { key: "medium", min: 7 },
  { key: "large", min: 30 },
  { key: "xlarge", min: 90 },
  { key: "max", min: 180 },
];

export function getTierForStreak(streak) {
  let key = "small";
  for (const t of CELEBRATION_TIERS) if (streak >= t.min) key = t.key;
  return key;
}
