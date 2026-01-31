const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");

const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const modalImg = document.getElementById("modalImg");

const siteTitle = document.getElementById("siteTitle");
const siteTagline = document.getElementById("siteTagline");
const countEl = document.getElementById("count");

const metaTitle = document.getElementById("metaTitle");
const metaYear = document.getElementById("metaYear");
const metaMedium = document.getElementById("metaMedium");
const metaSize = document.getElementById("metaSize");
const metaCredit = document.getElementById("metaCredit");
const metaLinks = document.getElementById("metaLinks");

// Footer contact toggle elements (exist in index.html)
const contactBtn = document.getElementById("contactBtn");
const contactEmail = document.getElementById("contactEmail");

let lastFocusedEl = null;

// ---------- helpers ----------
function safeText(v) {
  return v === undefined || v === null || v === "" ? "—" : String(v);
}

function isNonEmpty(v) {
  return !(v === undefined || v === null || String(v).trim() === "");
}

// ---------- modal focus trap ----------
function trapFocus(e) {
  if (!modal || modal.getAttribute("aria-hidden") === "true") return;

  const focusables = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const list = Array.from(focusables).filter((el) => !el.hasAttribute("disabled"));
  if (!list.length) return;

  const first = list[0];
  const last = list[list.length - 1];

  if (e.key === "Tab") {
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

// ---------- modal open/close ----------
function openModal(work) {
  lastFocusedEl = document.activeElement;

  const src = work.image2x || work.image;
  modalImg.src = src;
  modalImg.alt = work.alt || work.title || "Artwork";

  // Museum-y catalog style: Title is just another dt/dd entry
  metaTitle.textContent = safeText(work.title);
  metaYear.textContent = safeText(work.year);
  metaMedium.textContent = safeText(work.medium);
  metaSize.textContent = safeText(work.size);
  metaCredit.textContent = safeText(work.credit);

  metaLinks.innerHTML = "";
  if (isNonEmpty(work.srcUrl)) {
    const a = document.createElement("a");
    a.href = work.srcUrl;
    a.target = "_blank";
    a.rel = "noreferrer noopener";
    a.textContent = "SRC";
    metaLinks.appendChild(a);
  }

  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  modalClose?.focus();
}

function closeModal() {
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (modalImg) modalImg.src = "";
  if (lastFocusedEl) lastFocusedEl.focus();
}

modalClose?.addEventListener("click", closeModal);

// click backdrop to close
modal?.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// esc + focus trap
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal?.getAttribute("aria-hidden") === "false") closeModal();
  trapFocus(e);
});

// ---------- grid render ----------
function renderGrid(works) {
  if (!gridEl) return;
  gridEl.innerHTML = "";

  works.forEach((work) => {
    const card = document.createElement("article");
    card.className = "card";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", `Open details: ${work.title || work.id || "Artwork"}`);
    btn.addEventListener("click", () => openModal(work));

    const img = document.createElement("img");
    img.className = "thumb";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = work.image;
    img.alt = work.alt || work.title || "Artwork";

    if (work.image2x) {
      img.srcset = `${work.image} 1x, ${work.image2x} 2x`;
    }

    btn.appendChild(img);

    // Caption (2 optional lines) from JSON
    const cap = document.createElement("div");
    cap.className = "caption";

    const line1 = document.createElement("div");
    line1.className = "line1";
    line1.textContent = isNonEmpty(work.index_display_1) ? work.index_display_1 : "";
    cap.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "line2";
    line2.textContent = isNonEmpty(work.index_display_2) ? work.index_display_2 : "";
    cap.appendChild(line2);

    btn.appendChild(cap);

    card.appendChild(btn);
    gridEl.appendChild(card);
  });
}

// ----------- footer: LOADER ------------------

async function loadFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;

  try {
    const res = await fetch("/partials/footer.html");
    el.innerHTML = await res.text();
  } catch (err) {
    console.error("Failed to load footer", err);
  }
}

loadFooter();

// ---------- footer: CONTACT.EXE reveal/hide ----------
function setupContactReveal() {
  if (!contactBtn || !contactEmail) return;

  let revealed = false;

  function buildEmailFromDataset(btn) {
    const u = btn.dataset.u || "";
    const d = btn.dataset.d || "";
    const t = btn.dataset.t || "";
    if (!u || !d || !t) return "";
    return `${u}@${d}.${t}`;
  }

  function render() {
    if (!revealed) {
      contactEmail.textContent = "";
      contactBtn.setAttribute("aria-label", "Reveal contact email");
      return;
    }
    const email = buildEmailFromDataset(contactBtn);
    contactEmail.textContent = email ? email : "Email not configured yet.";
    contactBtn.setAttribute("aria-label", "Hide contact email");
  }

  contactBtn.addEventListener("click", () => {
    revealed = !revealed;
    render();
  });

  render();
}

// ---------- load JSON ----------
async function loadGallery() {
  try {
    if (statusEl) statusEl.textContent = "Loading…";

    const res = await fetch("./data/gallery.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load JSON (${res.status})`);

    const data = await res.json();

    if (data.site?.title && siteTitle) siteTitle.textContent = data.site.title;
    if (data.site?.tagline && siteTagline) siteTagline.textContent = data.site.tagline;

    const works = Array.isArray(data.works) ? data.works.slice() : [];
    works.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));

    if (countEl) countEl.textContent = works.length ? `${works.length} works` : "";

    renderGrid(works);

    if (statusEl) {
      statusEl.textContent = works.length
        ? ""
        : "No works yet. Add items to data/gallery.json.";
    }
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.textContent =
        "Could not load gallery.json. Make sure you're running a local server (not file://).";
    }
  }
}

// ---------- light protection (not bulletproof) ----------
document.addEventListener("contextmenu", (e) => {
  const isImage = e.target && e.target.tagName === "IMG";
  if (isImage) e.preventDefault();
});
document.addEventListener("dragstart", (e) => {
  const isImage = e.target && e.target.tagName === "IMG";
  if (isImage) e.preventDefault();
});

// boot
setupContactReveal();
loadGallery();
