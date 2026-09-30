import { saveShift, deleteShift } from "./db.js";
import { App } from "./app.js";
import { formatLocalDate } from "./streak.js";

// Intentional spelling (not "עבודה").
export const WORK_EVENT_TITLE = "עבודע";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Read-only: GET requests only. Returns Map<dateStr, "HH:mm"> for today and later. */
export async function fetchWorkShifts(token) {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const byDate = new Map();
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      q: WORK_EVENT_TITLE,
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${EVENTS_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`calendar api ${res.status}`);
    const data = await res.json();

    for (const ev of data.items || []) {
      // q is a fuzzy search, so re-check the exact title. All-day events have
      // no start time to use, so they can't define a shift.
      if (ev.status === "cancelled" || (ev.summary || "").trim() !== WORK_EVENT_TITLE) continue;
      if (!ev.start || !ev.start.dateTime) continue;
      const start = new Date(ev.start.dateTime);
      const date = formatLocalDate(start);
      const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      if (!byDate.has(date) || time < byDate.get(date)) byDate.set(date, time);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return byDate;
}

/** Adds/updates shifts from the calendar and removes stale calendar-sourced future ones. */
export async function syncShifts(token) {
  const desired = await fetchWorkShifts(token);
  const todayStr = formatLocalDate(new Date());
  let added = 0, updated = 0, removed = 0;

  for (const [date, startTime] of desired) {
    const existing = App.shiftsByDate.get(date);
    if (!existing) {
      await saveShift({ date, startTime, source: "calendar" });
      added++;
    } else if (existing.startTime !== startTime || existing.source !== "calendar") {
      await saveShift({ date, startTime, source: "calendar" });
      updated++;
    }
  }

  for (const shift of App.shifts) {
    if (shift.source === "calendar" && shift.date >= todayStr && !desired.has(shift.date)) {
      await deleteShift(shift.date);
      removed++;
    }
  }

  return { added, updated, removed };
}
