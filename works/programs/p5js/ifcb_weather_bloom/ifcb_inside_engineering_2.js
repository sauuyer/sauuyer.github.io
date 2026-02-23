// --- Flow-channel dots (plankton) ---
let dots = [];
let nextEventIdx = 0;

// If your HDR has a volume analyzed field, add its key here.
// We'll try a few common variants and fall back if none exist.
function hdrNumber(keys, fallback = 0) {
  for (const k of keys) {
    const v = Number(hdr[k]);
    if (isFinite(v)) return v;
  }
  return fallback;
}

// Cumulative look-time up to playback time (sec)
function cumulativeLookTimeAt(timeSec) {
  if (!events.length) return 0;

  // find last index where adcTime <= timeSec
  let lo = 0, hi = events.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].adcTime <= timeSec) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (ans < 0) return 0;

  // Fast path if we store prefix sums (added in section 2)
  return events[ans].lookCum || 0;
}

// Simple ease
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

class PlanktonDot {
  constructor(targetX, targetY, radiusPx) {
    // spawn from outside channel (left/right)
    const sideLeft = random() < 0.5;
    this.sx = sideLeft ? (flow.x - 120) : (flow.x + flow.w + 120);
    this.sy = flow.y + random(-60, flow.h + 60);

    this.x = this.sx;
    this.y = this.sy;

    this.tx = targetX;
    this.ty = targetY;

    this.r = radiusPx;

    this.birthMs = millis();
    this.travelMs = 650 + random(-180, 220);
    this.placed = false;
  }

  update(nowMs) {
    if (this.placed) return;
    const t = (nowMs - this.birthMs) / this.travelMs;
    if (t >= 1) {
      this.x = this.tx;
      this.y = this.ty;
      this.placed = true;
      return;
    }
    const e = easeOutCubic(constrain(t, 0, 1));
    this.x = lerp(this.sx, this.tx, e);
    this.y = lerp(this.sy, this.ty, e);
  }

  draw() {
    noStroke();
    fill(240, 230); // neutral bright dot
    circle(this.x, this.y, this.r * 2);
  }
}