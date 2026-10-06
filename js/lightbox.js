// Tap a prize thumbnail anywhere in the app to see it full size.
let overlay = null;

function close() {
  if (overlay) overlay.classList.add("hidden");
}

function open(src) {
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "lightbox hidden";
    overlay.innerHTML = '<img alt="">';
    overlay.addEventListener("click", close);
    document.body.appendChild(overlay);
  }
  overlay.querySelector("img").src = src;
  overlay.classList.remove("hidden");
}

document.addEventListener("click", (e) => {
  const img = e.target.closest?.(".reward-item img, .reward-card img");
  if (img && img.getAttribute("src")) open(img.src);
});
