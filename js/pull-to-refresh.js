// Pull-to-refresh for the standalone PWA (iOS has none, and
// overscroll-behavior:none in styles.css disables the browser's own).
const THRESHOLD = 70;
const MAX_PULL = 120;

export function initPullToRefresh(onRefresh) {
  const indicator = document.createElement("div");
  indicator.className = "ptr-indicator";
  indicator.textContent = "↓";
  document.body.appendChild(indicator);

  let startY = null;
  let pull = 0;
  let busy = false;

  const setPull = (px) => {
    pull = px;
    indicator.style.transform = `translate(-50%, ${px - 50}px) rotate(${px >= THRESHOLD ? 180 : 0}deg)`;
    indicator.style.opacity = String(Math.min(1, px / THRESHOLD));
  };

  const reset = () => {
    indicator.classList.remove("spinning");
    indicator.classList.add("settling");
    setPull(0);
    setTimeout(() => indicator.classList.remove("settling"), 200);
  };

  document.addEventListener("touchstart", (e) => {
    const blocked = busy || e.touches.length !== 1 || window.scrollY > 0 ||
      e.target.closest(".modal, .modal-backdrop, input, textarea, select");
    startY = blocked ? null : e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) {
      if (pull) setPull(0);
      return;
    }
    setPull(Math.min(MAX_PULL, dy * 0.5));
  }, { passive: true });

  const end = async () => {
    if (startY === null) return;
    startY = null;
    if (pull < THRESHOLD) return reset();
    busy = true;
    indicator.classList.add("spinning", "settling");
    indicator.textContent = "⟳";
    setPull(THRESHOLD);
    try {
      await onRefresh();
    } catch (e) {
      // offline etc.; just stop spinning
    }
    indicator.textContent = "↓";
    busy = false;
    reset();
  };
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });
}
