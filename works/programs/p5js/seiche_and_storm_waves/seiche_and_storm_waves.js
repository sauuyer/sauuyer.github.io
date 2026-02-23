/**
 * Seiche vs Large-Lake Storm Waves (p5.js)
 */

let stakes = [];
let t = 0;

// Controls
const NUM_STAKES = 40;
const MARGIN = 60;

// Story timing (frames)
const CALM_END = 900;
const STORM_BUILD_END = 1500;
const STORM_PEAK_END = 1900;
const CLEAR_END = 2500;

// Wave spectrum components for storm surface
let comps = [];
const NUM_COMPS = 12;

// “Physics-ish” constants for dispersion (tuned for visual)
const g = 9.81;

// Optional rain (kept grayscale). If you want fully minimal, set to false.
const ENABLE_RAIN = true;
let rain = [];
const MAX_RAIN = 240;

// Birds (kept)
let birds = [];

function setup() {
  createCanvas(900, 520);
  pixelDensity(2);
  background(245);

  for (let i = 0; i < NUM_STAKES; i++) {
    const x = map(i, 0, NUM_STAKES - 1, MARGIN, width - MARGIN);
    stakes.push({ x, phase: random(TWO_PI), drift: random(0.2, 1.2) });
  }

  buildWaveSpectrum();

  if (ENABLE_RAIN) {
    for (let i = 0; i < MAX_RAIN; i++) rain.push(makeDrop(true));
  }
}

function draw() {
  const storm = stormIntensity(t);
  const wind = windStrength(t, storm);

  // Trails: grayscale wipe
  noStroke();
  const wipe = lerp(10, 18, storm);
  fill(245, wipe);
  rect(0, 0, width, height);

  // Grain
  drawGrain(0.03 + storm * 0.02);

  // Seiche base
  const seicheY = seicheBaseLevel(t);

  // Draw separated signals
  drawWaveSystem(seicheY, storm, wind);

  // Stakes mark both levels
  drawStakes(seicheY, storm, wind);

  // Rain (optional)
  if (ENABLE_RAIN) drawRain(storm, wind);

  // Birds after storm
  handleBirds(storm);

  // Minimal label (grayscale)
  drawLabel(storm);

  t += 1;
}

/* -------------------- Seiche (low frequency) -------------------- */

function seicheBaseLevel(frame) {
  const modeA = sin(frame * 0.015) * 32;
  const modeB = sin(frame * 0.009 + 1.7) * 18;
  const drift = (noise(frame * 0.003) - 0.5) * 26;
  return height * 0.52 + modeA + modeB + drift;
}

/* -------------------- Storm wave spectrum (more realistic feel) -------------------- */

function buildWaveSpectrum() {
  comps = [];

  // Dominant wind-wave direction along +x (1D here),
  // but we mimic directional spread by varying phase speed & coherence.
  // Wavelengths: mix of long swell-like (large lake can build decent seas)
  // and shorter wind chop.
  const minLambda = 18;
  const maxLambda = 220;

  for (let i = 0; i < NUM_COMPS; i++) {
    // Bias towards longer waves (more “storm sea” than tiny ripples)
    const u = pow(random(), 0.55); // skew
    const lambda = lerp(minLambda, maxLambda, u);
    const k = TWO_PI / lambda;

    // Deep-water dispersion: omega = sqrt(g*k)
    // We scale omega to match our frame-time world.
    // (This is “physics-shaped,” not units-true.)
    const omega = sqrt(g * k) * 0.9;

    // Component weight: a peaked distribution around a dominant wavelength
    // (gives you recognizably “organized” storm waves)
    const dominant = 95;
    const spread = 0.55;
    const peak = exp(-pow((lambda - dominant) / (dominant * spread), 2));

    const ampBase = lerp(0.6, 1.8, peak) * (0.7 + random() * 0.6);

    comps.push({
      k,
      omega,
      ampBase,
      phase: random(TWO_PI),
      // Slight “groupiness” via per-component jitter
      jitter: random(0.6, 1.4)
    });
  }
}

function stormSurfaceOffset(xNorm, storm, wind) {
  // xNorm: 0..1 across lake width
  // “Fetch” feel: waves a bit smaller upwind, larger downwind during storm
  const fetch = lerp(0.7, 1.15, xNorm);

  // Gust modulation makes sets / lulls (very important for realism)
  const gust = 0.55 + 0.45 * noise(t * 0.02);
  const energy = stormEnergy(storm, wind) * fetch * gust;

  // Sum wave components with dispersion
  // Use x coordinate in “stake index space” for stable shape across width
  const x = xNorm * (NUM_STAKES - 1);

  let y = 0;
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];

    // Phase evolution: kx - ωt (waves moving in +x direction)
    // Multiply t slightly to get visually appropriate travel speed
    const tt = t * 0.11;
    const arg = c.k * (x * 26) - c.omega * tt * c.jitter + c.phase;

    // Slight nonlinearity: sharpen crests (storm seas look pointier)
    // tanh(sin) style-ish without heavy math:
    const s = sin(arg);
    const crest = s + 0.35 * s * abs(s);

    y += crest * c.ampBase;
  }

  // Add a small amount of fast noise for spray/chop texture (not dominant)
  const chopNoise = (noise(xNorm * 7.5, t * 0.09) - 0.5) * 2.0;

  // Final amplitude scales with storm energy
  return (y * 6.0 + chopNoise * 4.0) * energy;
}

function stormEnergy(storm, wind) {
  // Storm amplitude scaling: grows strongly as storm builds
  // wind term adds extra variance without changing the seiche
  const w = constrain(wind, 0, 2.2);
  const s = constrain(storm, 0, 1);
  return (0.08 + 0.95 * pow(s, 1.15)) * (0.7 + 0.35 * w);
}

/* -------------------- Draw both signals clearly -------------------- */

function drawWaveSystem(seicheY, storm, wind) {
  const seicheLine = [];
  const stormLine = [];

  for (let i = 0; i < stakes.length; i++) {
    const x = stakes[i].x;
    const xNorm = i / (NUM_STAKES - 1);

    // Seiche surface has only very low-frequency spatial texture
    const spatial = sin(xNorm * TWO_PI * 2 + t * 0.01) * 7;
    const tex = (noise(xNorm * 2.2, t * 0.004) - 0.5) * 10;

    const ySeiche = seicheY + spatial + tex;

    // Storm surface rides on seiche
    const dyStorm = stormSurfaceOffset(xNorm, storm, wind);
    const yStorm = ySeiche + dyStorm;

    seicheLine.push({ x, y: ySeiche });
    stormLine.push({ x, y: yStorm });
  }

  // Envelope band: only when storm is present
  const bandAmt = constrain(map(storm, 0.10, 1, 0, 1), 0, 1);
  const bandAlpha = lerp(0, 26, bandAmt);
  if (bandAlpha > 0.5) {
    noStroke();
    fill(0, bandAlpha);
    beginShape();
    for (let i = 0; i < stormLine.length; i++) vertex(stormLine[i].x, stormLine[i].y);
    for (let i = seicheLine.length - 1; i >= 0; i--) vertex(seicheLine[i].x, seicheLine[i].y);
    endShape(CLOSE);
  }

  // Seiche line: thick & steady
  stroke(0, 120);
  strokeWeight(3.5);
  noFill();
  beginShape();
  for (const p of seicheLine) vertex(p.x, p.y);
  endShape();

  // Storm surface: thin & lively (only visible when storm exists)
  const surfAlpha = lerp(0, 170, bandAmt);
  if (surfAlpha > 1) {
    stroke(0, surfAlpha);
    strokeWeight(1.4);
    noFill();
    beginShape();
    for (const p of stormLine) vertex(p.x, p.y);
    endShape();
  }

  // Occasional crest tick marks at storm peak (helps “large sea” read)
  if (storm > 0.7) {
    stroke(0, 55);
    strokeWeight(1);
    for (let i = 2; i < stormLine.length - 2; i++) {
      const y0 = stormLine[i - 1].y, y1 = stormLine[i].y, y2 = stormLine[i + 1].y;
      // y smaller = higher crest on screen
      if (y1 < y0 && y1 < y2 && random() < 0.33) {
        const x = stormLine[i].x;
        line(x, y1 - 7, x, y1 + 2);
      }
    }
  }
}

/* -------------------- Stakes mark BOTH levels -------------------- */

function drawStakes(seicheY, storm, wind) {
  for (let i = 0; i < stakes.length; i++) {
    const s = stakes[i];
    const xNorm = i / (NUM_STAKES - 1);

    // Local seiche marker (still low-frequency)
    const local = sin(t * 0.02 * s.drift + s.phase) * 6;
    const ySeicheLocal =
      seicheY +
      local +
      (noise(xNorm * 1.3, t * 0.006) - 0.5) * 8;

    const yStormLocal = ySeicheLocal + stormSurfaceOffset(xNorm, storm, wind);

    // Stake line (grayscale)
    stroke(0, lerp(60, 95, storm));
    strokeWeight(2);
    line(s.x, MARGIN, s.x, height - MARGIN);

    // Tick marks
    stroke(0, lerp(28, 50, storm));
    strokeWeight(1);
    for (let k = 0; k < 9; k++) {
      const ty = map(k, 0, 8, MARGIN + 15, height - MARGIN - 15);
      const tick = (k % 2 === 0) ? 10 : 6;
      line(s.x - tick, ty, s.x + tick, ty);
    }

    // Seiche marker: larger
    noStroke();
    fill(0, 150);
    circle(s.x, ySeicheLocal, 6);

    stroke(0, 35);
    strokeWeight(1);
    line(s.x - 18, ySeicheLocal, s.x + 18, ySeicheLocal);

    // Storm marker: smaller, appears during storm
    if (storm > 0.10) {
      noStroke();
      fill(0, lerp(0, 180, constrain(map(storm, 0.10, 1, 0, 1), 0, 1)));
      circle(s.x, yStormLocal, 3.5);

      stroke(0, 55);
      strokeWeight(1);
      line(s.x - 10, yStormLocal, s.x + 10, yStormLocal);
    }
  }
}

/* -------------------- Narrative helpers -------------------- */

function stormIntensity(frame) {
  if (frame < CALM_END) return 0;

  if (frame < STORM_BUILD_END) {
    const u = (frame - CALM_END) / (STORM_BUILD_END - CALM_END);
    return smoothstep(0, 1, u);
  }

  if (frame < STORM_PEAK_END) return 1;

  if (frame < CLEAR_END) {
    const u = (frame - STORM_PEAK_END) / (CLEAR_END - STORM_PEAK_END);
    return 1 - smoothstep(0, 1, u);
  }

  return 0.05;
}

function windStrength(frame, storm) {
  const gust = (noise(frame * 0.02) - 0.5) * 2;
  return (storm * 1.6 + 0.06) * (1 + 0.7 * gust);
}

function smoothstep(edge0, edge1, x) {
  const tt = constrain((x - edge0) / (edge1 - edge0), 0, 1);
  return tt * tt * (3 - 2 * tt);
}

/* -------------------- Rain (grayscale) -------------------- */

function makeDrop(randomizeY = false) {
  return {
    x: random(-50, width + 50),
    y: randomizeY ? random(-height, height) : random(-height, 0),
    vy: random(10, 18),
    len: random(10, 22),
    drift: random(0.6, 1.4)
  };
}

function drawRain(storm, wind) {
  const rainAmt = constrain(map(storm, 0.15, 1.0, 0, 1), 0, 1);
  if (rainAmt <= 0) return;

  const dropsToDraw = int(MAX_RAIN * rainAmt);

  stroke(0, lerp(0, 80, rainAmt));
  strokeWeight(1);

  for (let i = 0; i < dropsToDraw; i++) {
    const d = rain[i];

    const wx = wind * 6 * d.drift;
    const x2 = d.x + wx;
    const y2 = d.y + d.len;

    line(d.x, d.y, x2, y2);

    d.x += wx * 0.35;
    d.y += d.vy * (0.8 + rainAmt * 0.8);

    if (d.y > height + 30 || d.x < -80 || d.x > width + 80) {
      rain[i] = makeDrop(false);
      rain[i].y = random(-200, -20);
    }
  }
}

/* -------------------- Birds (post-storm) -------------------- */

function handleBirds(storm) {
  const inAfterStorm = t > STORM_PEAK_END && storm < 0.25;

  if (inAfterStorm && birds.length === 0) {
    birds.push(makeBird(-80, random(height * 0.14, height * 0.28), random(1.2, 1.7)));
    birds.push(makeBird(-140, random(height * 0.10, height * 0.24), random(1.4, 1.9)));
  }

  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    b.x += b.vx;
    b.y += sin((t + b.phase) * 0.08) * 0.18;
    drawBird(b.x, b.y, b.scale, b.phase);
    if (b.x > width + 120) birds.splice(i, 1);
  }
}

function makeBird(x, y, speed) {
  return { x, y, vx: speed * 2.4, scale: random(0.8, 1.15), phase: random(TWO_PI) };
}

function drawBird(x, y, s, ph) {
  const flap = sin((t * 0.18) + ph) * 5;
  push();
  translate(x, y);
  scale(s);
  stroke(0, 150);
  strokeWeight(2);
  noFill();
  beginShape();
  vertex(-14, 0);
  quadraticVertex(-7, -8 - flap * 0.3, 0, -2 - flap);
  quadraticVertex(7, -8 - flap * 0.3, 14, 0);
  endShape();
  pop();
}

/* -------------------- Minimal label -------------------- */

function drawLabel(storm) {
  noStroke();
  fill(0, 140);
  textFont("system-ui");
  textSize(14);
  textAlign(LEFT, TOP);

  const phase =
    (t < CALM_END) ? "calm seiche" :
    (t < STORM_BUILD_END) ? "storm building" :
    (t < STORM_PEAK_END) ? "storm peak" :
    (t < CLEAR_END) ? "storm passing" :
    "after storm";

  text(`Seiche (slow) vs storm waves (fast) — ${phase}`, 18, 16);

  fill(0, 95);
  textSize(12);
  text("Press S to save a frame", 18, 36);
}

/* -------------------- Grain -------------------- */

function drawGrain(amount) {
  loadPixels();
  const n = int(width * height * amount * 0.02);
  for (let i = 0; i < n; i++) {
    const x = int(random(width));
    const y = int(random(height));
    const idx = 4 * (y * width + x);
    const g = random(-18, 18);
    pixels[idx + 0] = constrain(pixels[idx + 0] + g, 0, 255);
    pixels[idx + 1] = constrain(pixels[idx + 1] + g, 0, 255);
    pixels[idx + 2] = constrain(pixels[idx + 2] + g, 0, 255);
  }
  updatePixels();
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("seiche_large_lake_storm", "png");
}