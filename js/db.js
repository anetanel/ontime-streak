const DB_NAME = "ontimeStreakDB";
const DB_VERSION = 3;

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
      if (db.objectStoreNames.contains("rewards")) {
        db.deleteObjectStore("rewards");
      }
      if (!db.objectStoreNames.contains("prizeAwards")) {
        db.createObjectStore("prizeAwards", { keyPath: "date" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("shifts")) {
        db.createObjectStore("shifts", { keyPath: "date" });
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
  graceMinutes: 5,
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

export async function getAllPrizeAwards() {
  const store = await tx("prizeAwards", "readonly");
  return wrap(store.getAll());
}

export async function savePrizeAward(award) {
  const store = await tx("prizeAwards", "readwrite");
  await wrap(store.put(award));
}

export async function deletePrizeAward(date) {
  const store = await tx("prizeAwards", "readwrite");
  await wrap(store.delete(date));
}

export async function getAllShifts() {
  const store = await tx("shifts", "readonly");
  return wrap(store.getAll());
}

export async function getShift(date) {
  const store = await tx("shifts", "readonly");
  return wrap(store.get(date));
}

export async function saveShift(shift) {
  const store = await tx("shifts", "readwrite");
  await wrap(store.put(shift));
}

export async function deleteShift(date) {
  const store = await tx("shifts", "readwrite");
  await wrap(store.delete(date));
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
  const [settings, checkins, prizeAwards, shifts, streakState] = await Promise.all([
    getSettings(),
    getAllCheckins(),
    getAllPrizeAwards(),
    getAllShifts(),
    getStreakState(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: DB_VERSION,
    settings,
    checkins,
    prizeAwards,
    shifts,
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

  const prizeAwardsStore = await tx("prizeAwards", "readwrite");
  await wrap(prizeAwardsStore.clear());
  for (const rec of data.prizeAwards || []) {
    await wrap(prizeAwardsStore.put(rec));
  }

  const shiftsStore = await tx("shifts", "readwrite");
  await wrap(shiftsStore.clear());
  for (const rec of data.shifts || []) {
    await wrap(shiftsStore.put(rec));
  }

  const metaStore = await tx("meta", "readwrite");
  await wrap(metaStore.put({ ...(data.streakState || {}), id: "streakState" }));
}

export async function resetAllData() {
  const stores = ["settings", "checkins", "prizeAwards", "shifts", "meta"];
  for (const name of stores) {
    const store = await tx(name, "readwrite");
    await wrap(store.clear());
  }
}
