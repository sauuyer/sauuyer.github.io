/**
 * Bloom as Weather — IFCB (HDR + ADC only)
 * Folder layout:
 * assets/manifest.json
 * assets/bins/<BIN_ID>/<BIN_ID>.hdr.txt
 * assets/bins/<BIN_ID>/<BIN_ID>.adc.csv
 *
 * Requires p5.sound
 */

let manifest;
let binIdx = 0;

// loaded data
let hdrLines, adcTable;
let hdr = {};
let events = [];
let stats = {};

// time/front
let runTimeSec = 1200;
let frontTime = 0;
let playback = 28;
let windowSec = 0.55;
let lastMillis = 0;

// scheduler pointers
let startIdx = 0;
let endIdx = 0;

// particles
let drops = [];

// sound
let soundEnabled = false;
let windNoise, windFilter;
let clickNoise, clickEnv, clickFilter;
let lightningEnv, lightningOsc;

function preload() {
  manifest = loadJSON("assets/manifest.json", (m) => {
    manifest = m;

    if (!Array.isArray(manifest)) {
      console.error("manifest is not an array:", manifest);
      // Attempt recovery if it's wrapped
      if (manifest && Array.isArray(manifest.bins)) manifest = manifest.bins;
    }

    console.log("manifest loaded:", manifest);

    if (!Array.isArray(manifest) || manifest.length === 0) {
      throw new Error("manifest.json must be a non-empty array");
    }

    const b = manifest[binIdx] || manifest[0];
    console.log("using bin:", b);

    hdrLines = loadStrings(b.hdr);
    adcTable = loadTable(b.adc, "csv", "noHeader");
  }, (err) => {
    console.error("Failed to load manifest:", err);
    throw new Error("Failed to load assets/manifest.json");
  });
}

function setup() {
  createCanvas(900, 520);
  background(10);
  pixelDensity(2);

  hdr = parseHdr(hdrLines.join("\n"));
  runTimeSec = Number(hdr.runTime) || runTimeSec;

  // Parse ADC into events
  events = [];
  const n = adcTable.getRowCount();
  for (let r = 0; r < n; r++) {
    const t = num(r, 1);            // ADCtime
    if (!isFinite(t)) continue;

    const peakA = num(r, 6);        // PeakA
    const tof = num(r, 10);         // TimeOfFlight
    const roiW = num(r, 15);        // RoiWidth
    const roiH = num(r, 16);        // RoiHeight

    events.push({ t, peakA, tof, roiW, roiH });
  }
  events.sort((a, b) => a.t - b.t);

  // If runTime missing/short, use max event time
  const maxT = events.length ? events[events.length - 1].t : runTimeSec;
  if (!isFinite(runTimeSec) || runTimeSec <= 0) runTimeSec = maxT || 1200;
  runTimeSec = max(runTimeSec, maxT);

  // Robust bounds
  stats.peakA = percentileBounds(events.map(e => e.peakA), 0.05, 0.95);
  stats.tof   = percentileBounds(events.map(e => e.tof),   0.05, 0.95);
  stats.peakA99 = percentile(events.map(e => e.peakA), 0.99);

  setupSound();

  lastMillis = millis();
}

function draw() {
  const now = millis();
  const dt = (now - lastMillis) / 1000;
  lastMillis = now;

  // fog fade (inhibit increases fog)
  const inhibitFrac = inhibitFraction();
  noStroke();
  fill(10, 14 + 60 * inhibitFrac);
  rect(0, 0, width, height);

  // advance front time
  frontTime += dt * playback;
  if (frontTime > runTimeSec) resetCycle();

  const frontX = (frontTime / runTimeSec) * width;

  const densN = densityNorm();
  drawFront(frontX, densN);

  updateWindowPointers();
  spawnFromWindow(frontX);

  // update/draw drops
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.life--;
    d.x += d.vx;
    d.y += d.vy;
    d.vx += d.ax;

    drawDrop(d);

    if (d.life <= 0 || d.y > height + 160 || d.x < -260) drops.splice(i, 1);
  }

  if (soundEnabled) updateWindSound(densN);

  drawHUD(densN);
}

function mousePressed() {
  if (!soundEnabled) {
    userStartAudio();
    startSound();
    soundEnabled = true;
  }
}

// ---------- visuals ----------
function drawFront(x, densN) {
  const bandW = lerp(90, 260, densN);
  const bandA = lerp(10, 32, densN);

  noStroke();
  for (let i = 0; i < 6; i++) {
    const w = bandW * (1 + i * 0.22);
    fill(200, 220, 255, bandA / (i + 1));
    rect(x - w * 0.5, 0, w, height);
  }

  stroke(200, 220, 255, 70);
  strokeWeight(1.5);
  line(x, 0, x, height);
}

function drawDrop(d) {
  strokeWeight(d.thick);

  for (let i = d.smearSteps; i >= 0; i--) {
    const k = i / max(1, d.smearSteps);
    const ox = -d.vx * d.smearLen * k;
    const oy = -d.vy * d.smearLen * k;
    stroke(180, 210, 255, d.a / (1 + i * 0.7));
    line(d.x, d.y, d.x + ox, d.y + oy);
  }
}

// ---------- scheduling ----------
function updateWindowPointers() {
  const tMin = frontTime - windowSec;
  const tMax = frontTime + windowSec;

  while (startIdx < events.length && events[startIdx].t < tMin) startIdx++;
  if (endIdx < startIdx) endIdx = startIdx;
  while (endIdx < events.length && events[endIdx].t <= tMax) endIdx++;
}

function spawnFromWindow(frontX) {
  const densN = densityNorm();
  const pBase = lerp(0.03, 0.16, densN);

  for (let i = startIdx; i < endIdx; i++) {
    const e = events[i];
    if (random() > pBase) continue;

    const d = makeDrop(e, frontX);
    drops.push(d);

    if (soundEnabled) triggerClick(e, densN);
    if (soundEnabled && e.peakA >= stats.peakA99 && random() < 0.25) triggerLightning(densN);
  }

  if (drops.length > 1800) drops.splice(0, drops.length - 1800);
}

function makeDrop(e, frontX) {
  const pA = normLog(e.peakA, stats.peakA.lo, stats.peakA.hi);
  const tofN = norm(e.tof, stats.tof.lo, stats.tof.hi);

  const aspect = (e.roiW > 0 && e.roiH > 0) ? e.roiW / e.roiH : 1.0;

  const x = frontX + randomGaussian(0, lerp(12, 42, densityNorm()));
  const y = lerp(height * 0.86, height * 0.14, pA) + randomGaussian(0, 8);

  const vx = -lerp(0.2, 2.2, pA);
  const vy =  lerp(0.3, 3.0, pA);

  const smearLen = lerp(18, 120, tofN) * lerp(0.7, 1.3, aspect);
  const smearSteps = int(lerp(2, 10, tofN));

  return {
    x, y,
    vx, vy,
    ax: (noise(e.t * 0.05) - 0.5) * 0.02,
    smearLen,
    smearSteps,
    thick: lerp(0.4, 5.5, pA),
    a: lerp(25, 150, pA) * (1.0 - 0.35 * inhibitFraction()),
    life: int(lerp(26, 120, 1 - pA))
  };
}

function resetCycle() {
  frontTime = 0;
  startIdx = 0;
  endIdx = 0;
  drops = [];
}

// ---------- sound ----------
function setupSound() {
  windNoise = new p5.Noise("pink");
  windFilter = new p5.LowPass();
  windNoise.disconnect();
  windNoise.connect(windFilter);
  windNoise.amp(0.0);

  clickNoise = new p5.Noise("white");
  clickFilter = new p5.BandPass();
  clickNoise.disconnect();
  clickNoise.connect(clickFilter);
  clickNoise.amp(0.0);

  clickEnv = new p5.Envelope();
  clickEnv.setADSR(0.001, 0.03, 0.0, 0.06);
  clickEnv.setRange(0.22, 0.0);

  lightningOsc = new p5.Oscillator("triangle");
  lightningEnv = new p5.Envelope();
  lightningEnv.setADSR(0.001, 0.03, 0.0, 0.15);
  lightningEnv.setRange(0.25, 0.0);

  lightningOsc.amp(0.0);
}

function startSound() {
  windNoise.start();
  clickNoise.start();
  lightningOsc.start();
}

function updateWindSound(densN) {
  const roiRate = roiCountPerSec();
  const trigRate = triggerCountPerSec();

  const cutoff = map(roiRate || densN * 8, 0, 10, 220, 3600, true);
  windFilter.freq(cutoff);

  const amp = map(trigRate || densN * 12, 0, 20, 0.02, 0.22, true) * (1.0 - 0.55 * inhibitFraction());
  windNoise.amp(amp, 0.15);
}

function triggerClick(e, densN) {
  const pA = normLog(e.peakA, stats.peakA.lo, stats.peakA.hi);
  const tofN = norm(e.tof, stats.tof.lo, stats.tof.hi);

  const f = lerp(700, 3400, lerp(0.2, 1.0, pA));
  clickFilter.freq(f);
  clickFilter.res(lerp(4, 12, densN));

  const atk = 0.001;
  const dec = lerp(0.02, 0.06, densN);
  const rel = lerp(0.03, 0.16, tofN);
  clickEnv.setADSR(atk, dec, 0.0, rel);

  clickEnv.setRange(lerp(0.06, 0.20, densN) * lerp(0.6, 1.15, pA), 0.0);
  clickEnv.play(clickNoise);
}

function triggerLightning(densN) {
  lightningOsc.freq(lerp(900, 1600, random()));
  lightningEnv.setRange(lerp(0.10, 0.28, densN), 0.0);
  lightningEnv.play(lightningOsc);
}

// ---------- hdr-derived metrics ----------
function roiCountPerSec() {
  const roiCount = Number(hdr.roiCount) || 0;
  const rt = Number(hdr.runTime) || runTimeSec;
  return rt > 0 ? roiCount / rt : 0;
}

function triggerCountPerSec() {
  const triggerCount = Number(hdr.triggerCount) || 0;
  const rt = Number(hdr.runTime) || runTimeSec;
  return rt > 0 ? triggerCount / rt : 0;
}

function densityNorm() {
  const roiRate = roiCountPerSec();
  return constrain(roiRate / 10.0, 0, 1);
}

function inhibitFraction() {
  const rt = Number(hdr.runTime) || runTimeSec;
  const it = Number(hdr.inhibitTime) || 0;
  return rt > 0 ? constrain(it / rt, 0, 1) : 0;
}

// ---------- parsing + utils ----------
function parseHdr(txt) {
  const out = {};
  txt.split("\n").forEach(line => {
    const i = line.indexOf(":");
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function num(r, c) {
  return Number(adcTable.getString(r, c));
}

function norm(v, lo, hi) {
  if (!isFinite(v) || !isFinite(lo) || !isFinite(hi) || hi === lo) return 0;
  return constrain((v - lo) / (hi - lo), 0, 1);
}

function normLog(v, lo, hi) {
  const vv = max(v, 1e-9);
  const l0 = Math.log(max(lo, 1e-9));
  const l1 = Math.log(max(hi, 1e-9));
  if (!isFinite(l0) || !isFinite(l1) || l1 === l0) return 0;
  return constrain((Math.log(vv) - l0) / (l1 - l0), 0, 1);
}

function percentileBounds(arr, pLo, pHi) {
  const a = arr.filter(x => isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return { lo: 0, hi: 1 };
  const lo = a[Math.floor(pLo * (a.length - 1))];
  const hi = a[Math.floor(pHi * (a.length - 1))];
  return { lo, hi };
}

function percentile(arr, p) {
  const a = arr.filter(x => isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return 0;
  return a[Math.floor(p * (a.length - 1))];
}

function drawHUD(densN) {
  noStroke();
  fill(240, 180);
  textFont("system-ui");
  textSize(13);
  textAlign(LEFT, TOP);

  const id = manifest?.[binIdx]?.id ?? "";
  text(`Bloom as Weather — ${id} (click to enable sound)`, 12, 10);

  fill(240, 120);
  textSize(12);
  text(
    `frontTime: ${frontTime.toFixed(1)}s / ${runTimeSec.toFixed(1)}s   ` +
    `rows: ${events.length}   drops: ${drops.length}`,
    12, 28
  );

  text(
    `roiRate: ${roiCountPerSec().toFixed(2)}/s   trigRate: ${triggerCountPerSec().toFixed(2)}/s   densN: ${densN.toFixed(2)}   inhibit: ${(inhibitFraction()*100).toFixed(1)}%`,
    12, 44
  );
}