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
        await navigator.share({ files: [file], title: "גיבוי רצף בזמן" });
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
          reject(new Error("הקובץ הזה לא נראה כמו גיבוי תקין של האפליקציה."));
          return;
        }
        resolve(data);
      } catch (e) {
        reject(new Error("לא ניתן לקרוא את הקובץ — ייתכן שהוא פגום."));
      }
    };
    reader.onerror = () => reject(new Error("לא ניתן לקרוא את הקובץ."));
    reader.readAsText(file);
  });
}

export async function importBackup(data) {
  await importAllData(data);
}
