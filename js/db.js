const DB_NAME = "ontimeStreakDB";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("checkins")) {
        db.createObjectStore("checkins", { keyPath: "date" });
      }
      if (!db.objectStoreNames.contains("rewards")) {
        db.createObjectStore("rewards", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const DEFAULT_SETTINGS = {
  id: "settings",
  expectedStartTime: "09:00",
  graceMinutes: 10,
  weeklySchedule: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  soundEnabled: true,
  themePreference: "system",
  lastBackupAt: null,
  createdAt: new Date().toISOString(),
};

export async function getSettings() {
  const store = await tx("settings", "readonly");
  const result = await wrap(store.get("settings"));
  return result || { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings) {
  const store = await tx("settings", "readwrite");
  await wrap(store.put({ ...settings, id: "settings" }));
}

export async function getAllCheckins() {
  const store = await tx("checkins", "readonly");
  return wrap(store.getAll());
}

export async function getCheckin(date) {
  const store = await tx("checkins", "readonly");
  return wrap(store.get(date));
}

export async function saveCheckin(record) {
  const store = await tx("checkins", "readwrite");
  await wrap(store.put(record));
}

export async function getAllRewards() {
  const store = await tx("rewards", "readonly");
  const list = await wrap(store.getAll());
  return list.sort((a, b) => a.thresholdDays - b.thresholdDays);
}

export async function saveReward(reward) {
  const store = await tx("rewards", "readwrite");
  const id = await wrap(store.put(reward));
  return id;
}

export async function deleteReward(id) {
  const store = await tx("rewards", "readwrite");
  await wrap(store.delete(id));
}

export async function getStreakState() {
  const store = await tx("meta", "readonly");
  const result = await wrap(store.get("streakState"));
  return result || { id: "streakState", currentStreak: 0, longestStreak: 0, lastComputedForDate: null };
}

export async function saveStreakState(state) {
  const store = await tx("meta", "readwrite");
  await wrap(store.put({ ...state, id: "streakState" }));
}

export async function exportAllData() {
  const [settings, checkins, rewards, streakState] = await Promise.all([
    getSettings(),
    getAllCheckins(),
    getAllRewards(),
    getStreakState(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: DB_VERSION,
    settings,
    checkins,
    rewards,
    streakState,
  };
}

export async function importAllData(data) {
  const settingsStore = await tx("settings", "readwrite");
  await wrap(settingsStore.put({ ...data.settings, id: "settings" }));

  const checkinsStore = await tx("checkins", "readwrite");
  await wrap(checkinsStore.clear());
  for (const rec of data.checkins || []) {
    await wrap(checkinsStore.put(rec));
  }

  const rewardsStore = await tx("rewards", "readwrite");
  await wrap(rewardsStore.clear());
  for (const rec of data.rewards || []) {
    await wrap(rewardsStore.put(rec));
  }

  const metaStore = await tx("meta", "readwrite");
  await wrap(metaStore.put({ ...(data.streakState || {}), id: "streakState" }));
}

export async function resetAllData() {
  const stores = ["settings", "checkins", "rewards", "meta"];
  for (const name of stores) {
    const store = await tx(name, "readwrite");
    await wrap(store.clear());
  }
}
