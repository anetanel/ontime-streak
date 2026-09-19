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
 * Walks backward from today recomputing the streak.
 * checkinsByDate: Map<dateStr, checkinRecord>
 * shiftsByDate: Map<dateStr, shiftRecord>
 */
export function computeStreak(checkinsByDate, shiftsByDate, today = new Date(), maxDays = 3650) {
  let streak = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let isToday = true;

  for (let i = 0; i < maxDays; i++) {
    const dateStr = formatLocalDate(cursor);
    const scheduled = isScheduledDay(dateStr, shiftsByDate);

    if (scheduled) {
      const rec = checkinsByDate.get(dateStr);
      if (rec && rec.status === "on-time") {
        streak += 1;
      } else if (rec && rec.status === "late") {
        break;
      } else if (!rec) {
        if (isToday) {
          // today hasn't happened yet, skip without breaking or counting
        } else {
          break;
        }
      }
    }
    // non-scheduled days are skipped silently

    isToday = false;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function computeLongestStreak(checkinsByDate, shiftsByDate, today = new Date(), maxDays = 3650) {
  // Walk forward from the earliest record to today, tracking the best run.
  const dates = Array.from(checkinsByDate.keys()).sort();
  if (dates.length === 0) return 0;

  const start = parseLocalDate(dates[0]);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let run = 0;
  let longest = 0;
  const cursor = new Date(start);

  for (let i = 0; i < maxDays && cursor.getTime() <= end.getTime(); i++) {
    const dateStr = formatLocalDate(cursor);
    if (isScheduledDay(dateStr, shiftsByDate)) {
      const rec = checkinsByDate.get(dateStr);
      if (rec && rec.status === "on-time") {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return longest;
}

export function getTierForStreak(streak) {
  if (streak >= 30) return "max";
  if (streak >= 14) return "bigFireworks";
  if (streak >= 7) return "fireworks";
  if (streak >= 3) return "medium";
  return "small";
}
