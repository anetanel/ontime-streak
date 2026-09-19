import { saveReward, deleteReward } from "./db.js";
import { App, refreshAll, showModal, hideModal } from "./app.js";

let els = {};
let editingId = null;
let pendingImage = null;

export function initRewards() {
  els.list = document.getElementById("rewards-list");
  els.empty = document.getElementById("rewards-empty");
  els.addBtn = document.getElementById("add-reward-btn");
  els.modal = document.getElementById("reward-form-modal");
  els.title = document.getElementById("reward-form-title");
  els.preview = document.getElementById("reward-form-preview");
  els.placeholder = document.getElementById("reward-form-placeholder");
  els.choosePhoto = document.getElementById("reward-form-choose-photo");
  els.file = document.getElementById("reward-form-file");
  els.name = document.getElementById("reward-form-name");
  els.threshold = document.getElementById("reward-form-threshold");
  els.error = document.getElementById("reward-form-error");
  els.save = document.getElementById("reward-form-save");
  els.delete = document.getElementById("reward-form-delete");
  els.cancel = document.getElementById("reward-form-cancel");

  els.addBtn.addEventListener("click", () => openForm(null));
  els.cancel.addEventListener("click", () => hideModal(els.modal));
  els.choosePhoto.addEventListener("click", () => els.file.click());
  els.file.addEventListener("change", handleFileChosen);
  els.save.addEventListener("click", handleSave);
  els.delete.addEventListener("click", handleDelete);
}

function openForm(reward) {
  editingId = reward ? reward.id : null;
  pendingImage = reward ? reward.imageBase64 || null : null;
  els.title.textContent = reward ? "Edit Reward" : "Add Reward";
  els.name.value = reward ? reward.title : "";
  els.threshold.value = reward ? reward.thresholdDays : "";
  els.error.style.display = "none";
  els.delete.style.display = reward ? "block" : "none";
  updatePreview();
  showModal(els.modal);
}

function updatePreview() {
  if (pendingImage) {
    els.preview.src = pendingImage;
    els.preview.style.display = "block";
    els.placeholder.style.display = "none";
  } else {
    els.preview.style.display = "none";
    els.placeholder.style.display = "flex";
  }
}

function handleFileChosen(e) {
  const file = e.target.files[0];
  if (!file) return;
  downscaleImage(file, 800, 0.82).then((dataUrl) => {
    pendingImage = dataUrl;
    updatePreview();
  });
}

function downscaleImage(file, maxEdge, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxEdge) {
          height = Math.round((height * maxEdge) / width);
          width = maxEdge;
        } else if (height > maxEdge) {
          width = Math.round((width * maxEdge) / height);
          height = maxEdge;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleSave() {
  const title = els.name.value.trim();
  const threshold = parseInt(els.threshold.value, 10);

  if (!title) return showError("Give this reward a name.");
  if (!threshold || threshold < 1) return showError("Enter a streak length of 1 or more days.");

  const duplicate = App.rewards.find((r) => r.thresholdDays === threshold && r.id !== editingId);
  if (duplicate) return showError(`Day ${threshold} is already used by "${duplicate.title}".`);

  const reward = {
    title,
    thresholdDays: threshold,
    imageBase64: pendingImage,
    animationTierOverride: null,
    updatedAt: new Date().toISOString(),
  };
  if (editingId) {
    reward.id = editingId;
  } else {
    reward.createdAt = new Date().toISOString();
  }

  await saveReward(reward);
  hideModal(els.modal);
  await refreshAll();
}

async function handleDelete() {
  if (editingId == null) return;
  if (!confirm("Delete this reward? This can't be undone.")) return;
  await deleteReward(editingId);
  hideModal(els.modal);
  await refreshAll();
}

function showError(msg) {
  els.error.textContent = msg;
  els.error.style.display = "block";
}

export function renderRewards(app) {
  if (app.rewards.length === 0) {
    els.list.innerHTML = "";
    els.empty.style.display = "block";
    return;
  }
  els.empty.style.display = "none";
  els.list.innerHTML = app.rewards
    .map(
      (r) => `
      <div class="reward-item" data-id="${r.id}">
        ${r.imageBase64 ? `<img src="${r.imageBase64}" alt="">` : `<div class="placeholder">🎵</div>`}
        <div class="info">
          <div class="title">${escapeHtml(r.title)}</div>
          <div class="sub">Day ${r.thresholdDays}${r.thresholdDays <= app.currentStreak ? " · Unlocked" : ""}</div>
        </div>
        <button class="icon-btn edit-btn" data-id="${r.id}">✏️</button>
      </div>
    `
    )
    .join("");

  els.list.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reward = app.rewards.find((r) => r.id === Number(btn.dataset.id));
      openForm(reward);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
