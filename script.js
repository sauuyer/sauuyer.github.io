const dialog = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCap = document.getElementById("lb-cap");
const closeBtn = document.querySelector(".lb-close");

function openLightbox(fullSrc, alt, captionHtml){
  lbImg.src = fullSrc;
  lbImg.alt = alt || "";
  lbCap.innerHTML = captionHtml || "";
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", ""); // fallback-ish
}

function closeLightbox(){
  lbImg.src = "";
  lbImg.alt = "";
  lbCap.innerHTML = "";
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tile-btn");
  if (!btn) return;

  const full = btn.dataset.full;
  const alt = btn.dataset.alt;
  const cap = btn.dataset.caption;
  openLightbox(full, alt, cap);
});

closeBtn.addEventListener("click", closeLightbox);

// click outside image closes
dialog.addEventListener("click", (e) => {
  const figure = dialog.querySelector(".lb-figure");
  if (!figure.contains(e.target)) closeLightbox();
});

// Esc closes automatically for <dialog>, but keep a fallback:
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dialog.open) closeLightbox();
});

