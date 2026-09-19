import { exportAllData, importAllData, saveSettings, getSettings } from "./db.js";

export async function exportBackup() {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `ontime-streak-backup-${data.exportedAt.slice(0, 10)}.json`;

  const settings = await getSettings();
  settings.lastBackupAt = new Date().toISOString();
  await saveSettings(settings);

  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "On-Time Streak Backup" });
        return { method: "share" };
      }
    } catch (e) {
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { method: "download" };
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.settings || !Array.isArray(data.checkins) || !Array.isArray(data.rewards)) {
          reject(new Error("This file doesn't look like a valid On-Time Streak backup."));
          return;
        }
        resolve(data);
      } catch (e) {
        reject(new Error("Couldn't read that file — it may be corrupted."));
      }
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}

export async function importBackup(data) {
  await importAllData(data);
}
