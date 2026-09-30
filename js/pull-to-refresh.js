// Pull-to-refresh for the standalone PWA (iOS has none, and
// overscroll-behavior:none in styles.css disables the browser's own).
const THRESHOLD = 70;
const MAX_PULL = 120;
// An SVG (not the ⟳ glyph) so the visual center matches the box we rotate around.
const SPINNER_SVG = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>';

export function initPullToRefresh(onRefresh) {
  const indicator = document.createElement("div");
  indicator.className = "ptr-indicator";
  const glyph = document.createElement("span");
  glyph.className = "ptr-glyph";
  glyph.textContent = "↓";
  indicator.appendChild(glyph);
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
    glyph.innerHTML = SPINNER_SVG;
    setPull(THRESHOLD);
    try {
      await onRefresh();
    } catch (e) {
      // offline etc.; just stop spinning
    }
    glyph.textContent = "↓";
    busy = false;
    reset();
  };
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });
}
