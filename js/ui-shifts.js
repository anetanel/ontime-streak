import { saveShift, deleteShift } from "./db.js";
import { App, refreshAll, showModal, hideModal } from "./app.js";
import { formatLocalDate, parseLocalDate } from "./streak.js";

let els = {};
let editingDate = null;

export function initShifts() {
  els.list = document.getElementById("shifts-list");
  els.empty = document.getElementById("shifts-empty");
  els.addBtn = document.getElementById("add-shift-btn");
  els.modal = document.getElementById("shift-form-modal");
  els.title = document.getElementById("shift-form-title");
  els.date = document.getElementById("shift-form-date");
  els.time = document.getElementById("shift-form-time");
  els.error = document.getElementById("shift-form-error");
  els.save = document.getElementById("shift-form-save");
  els.delete = document.getElementById("shift-form-delete");
  els.cancel = document.getElementById("shift-form-cancel");

  els.addBtn.addEventListener("click", () => openForm(null));
  els.cancel.addEventListener("click", () => hideModal(els.modal));
  els.save.addEventListener("click", handleSave);
  els.delete.addEventListener("click", handleDelete);
}

function defaultNewDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
}

function openForm(shift) {
  editingDate = shift ? shift.date : null;
  els.title.textContent = shift ? "עריכת משמרת" : "הוספת משמרת";
  els.date.value = shift ? shift.date : defaultNewDate();
  els.time.value = shift ? shift.startTime : "";
  els.error.style.display = "none";
  els.delete.style.display = shift ? "block" : "none";
  showModal(els.modal);
}

async function handleSave() {
  const date = els.date.value;
  const startTime = els.time.value;

  if (!date) return showError("בחרי תאריך.");
  if (!startTime) return showError("בחרי שעת התחלה.");

  if (editingDate && editingDate !== date) {
    await deleteShift(editingDate);
  }
  await saveShift({ date, startTime });
  hideModal(els.modal);
  await refreshAll();
}

async function handleDelete() {
  if (!editingDate) return;
  if (!confirm("למחוק את המשמרת?")) return;
  await deleteShift(editingDate);
  hideModal(els.modal);
  await refreshAll();
}

function showError(msg) {
  els.error.textContent = msg;
  els.error.style.display = "block";
}

export function renderShifts(app) {
  const todayStr = formatLocalDate(new Date());
  const upcoming = app.shifts
    .filter((s) => s.date >= todayStr)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (upcoming.length === 0) {
    els.list.innerHTML = "";
    els.empty.style.display = "block";
    return;
  }
  els.empty.style.display = "none";

  els.list.innerHTML = upcoming
    .map((s) => {
      const d = parseLocalDate(s.date);
      const label = d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" });
      const isToday = s.date === todayStr;
      return `
      <div class="reward-item" data-date="${s.date}">
        <div class="info">
          <div class="title">${label}${isToday ? " · היום" : ""}</div>
          <div class="sub">התחלה בשעה ${s.startTime}</div>
        </div>
        <button class="icon-btn edit-btn" data-date="${s.date}">✏️</button>
      </div>
    `;
    })
    .join("");

  els.list.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const shift = app.shifts.find((s) => s.date === btn.dataset.date);
      openForm(shift);
    });
  });
}
