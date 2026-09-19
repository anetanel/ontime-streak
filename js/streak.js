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

export function computeCheckinResult(now, shift, graceMinutes) {
  const dateStr = formatLocalDate(now);
  const [h, m] = shift.startTime.split(":").map(Number);
  const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m + graceMinutes, 0, 0);
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
function scanStreaks(checkinsByDate, shiftsByDate, today, maxDays) {
  const todayStr = formatLocalDate(today);
  const dates = Array.from(checkinsByDate.keys()).sort();
  const earliestStr = dates.length && dates[0] < todayStr ? dates[0] : todayStr;

  let run = 0;
  let longest = 0;
  let exemptionUsed = false;
  const cursor = parseLocalDate(earliestStr);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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

  return { current: run, longest };
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
 * breaking the streak, i.e. no "unforeseen" exemption has already been
 * used earlier in the streak period ending the day before dateStr.
 */
export function isLateExemptionAvailable(checkinsByDate, shiftsByDate, dateStr) {
  const cursor = parseLocalDate(dateStr);
  cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 3650; i++) {
    const cursorStr = formatLocalDate(cursor);
    if (isScheduledDay(cursorStr, shiftsByDate)) {
      const rec = checkinsByDate.get(cursorStr);
      if (rec && rec.status === "on-time") {
        // continue further back
      } else if (rec && rec.status === "late" && rec.lateReason === "unforeseen") {
        return false;
      } else {
        return true;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return true;
}

export function getTierForStreak(streak) {
  if (streak >= 30) return "max";
  if (streak >= 14) return "bigFireworks";
  if (streak >= 7) return "fireworks";
  if (streak >= 3) return "medium";
  return "small";
}
