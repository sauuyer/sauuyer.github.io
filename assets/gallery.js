const DATA_URL = "./data/gallery.json";

const gridRoot = document.getElementById("gridRoot");
const marqueeTrack = document.getElementById("marqueeTrack");
const siteTitle = document.getElementById("siteTitle");
const siteTagline = document.getElementById("siteTagline");

// Lightbox
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxClose = document.getElementById("lightboxClose");

lightboxClose.addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (e) => {
  // click outside the figure closes
  const rect = lightbox.querySelector(".lightbox__figure").getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) lightbox.close();
});

function openLightbox(work){
  lightboxImg.src = work.image2x || work.image;
  lightboxImg.alt = work.alt || work.title || "";
  lightboxCaption.innerHTML = captionHTML(work);
  lightbox.showModal();
}

function captionHTML(work){
  const lines = [];
  if (work.title) lines.push(escapeHtml(work.title));
  if (work.year) lines.push(escapeHtml(work.year));
  if (work.medium) lines.push(escapeHtml(work.medium));
  if (work.size && work.size !== "—") lines.push(escapeHtml(work.size));
  if (work.credit) lines.push(escapeHtml(work.credit));

  let html = lines.join("<br>");
  if (work.srcUrl) {
    const safeUrl = work.srcUrl;
    html += `<br><a href="${safeUrl}" target="_blank" rel="noopener">SRC</a>`;
  }
  return html;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function makeGridCard(work){
  const wrap = document.createElement("article");
  wrap.className = "card";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = work.image;
  if (work.image2x) img.srcset = `${work.image} 1x, ${work.image2x} 2x`;
  img.alt = work.alt || work.title || "";

  const cap = document.createElement("div");
  cap.className = "caption";
  cap.innerHTML = captionHTML(work);

  wrap.appendChild(img);
  wrap.appendChild(cap);

  wrap.addEventListener("click", () => openLightbox(work));
  return wrap;
}

function makeMarqueeItem(work){
  const wrap = document.createElement("div");
  wrap.className = "marquee__item";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = work.image;
  if (work.image2x) img.srcset = `${work.image} 1x, ${work.image2x} 2x`;
  img.alt = work.alt || work.title || "";

  wrap.appendChild(img);
  wrap.addEventListener("click", () => openLightbox(work));
  return wrap;
}

function render({ site, works }){
  if (site?.title) siteTitle.textContent = site.title;
  if (site?.tagline) siteTagline.textContent = site.tagline;

  const sorted = [...works].sort((a,b) => (a.order ?? 9999) - (b.order ?? 9999));

  // Grid: show all by default (or filter by tag if you want)
  gridRoot.innerHTML = "";
  for (const w of sorted){
    gridRoot.appendChild(makeGridCard(w));
  }

  // Marquee: only items tagged "marquee" (fallback to first 6)
  marqueeTrack.innerHTML = "";
  const marqueeWorks = sorted.filter(w => (w.tags || []).includes("marquee"));
  const list = marqueeWorks.length ? marqueeWorks : sorted.slice(0, 6);

  // To mimic Cargo-style repeating, duplicate content a few times for smooth looping
  const repeats = 4;
  for (let r = 0; r < repeats; r++){
    for (const w of list){
      marqueeTrack.appendChild(makeMarqueeItem(w));
    }
  }

  startMarquee(document.querySelector(".marquee"), marqueeTrack);
}

// Lightweight marquee with “friction” feel
function startMarquee(container, track){
  const speedAttr = Number(container.dataset.speed || -35);   // pixels/sec (negative = left)
  const friction = Number(container.dataset.friction || 0.06);

  let velocity = speedAttr;
  let x = 0;
  let last = performance.now();

  function tick(now){
    const dt = (now - last) / 1000;
    last = now;

    // friction eases velocity toward target speed
    velocity += (speedAttr - velocity) * friction;

    x += velocity * dt;

    // Loop when we've shifted beyond 1/4 of track width (since we duplicated)
    const trackWidth = track.scrollWidth;
    const loopPoint = trackWidth / 4;
    if (Math.abs(x) > loopPoint) x = 0;

    track.style.transform = `translate3d(${x}px, 0, 0)`;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

async function init(){
  const res = await fetch(DATA_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
  const data = await res.json();
  render(data);
}

init().catch(err => {
  gridRoot.innerHTML = `<p>Couldn’t load gallery data. ${escapeHtml(err.message)}</p>`;
});
