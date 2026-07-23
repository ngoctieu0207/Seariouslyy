/* ------------------------------------------------------------------
   Ocean background with creature stickers + particles overlay.
   
   Background images (sky, sand, sea) are now in HTML/CSS.
   This script loads them to:
   - Calculate canvas dimensions
   - Sample pixels for creature placement zones
   
   Canvas renders: creatures + bubbles + sparkles + grains
------------------------------------------------------------------- */

const sketch = (p) => {
  let imgSand, imgSea, imgSky;
  let scale = 1;
  let hSky = 0, hSea = 0, hSand = 0;
  let totalH = 0;

  let bubbles = [];
  let sparkles = [];
  let grains = [];

  // ================================================================
  // Sea-creature stickers 
  // ================================================================

  let creatureImgs = {};

  const CREATURE_FILES = [
    "con ca duoi.png",
    "con ca  heo.png",
    "con ca mup.png",
    "con ca ngua.png",
    "con muc.png",
    "con rua.png",
    "con sua.png",
    "ngoi sao.png",
  ];

  const DARK_CREATURE_FILES = [
    "con bach tuot rac.png",
    "con ca heo rac.png",
    "con ca rac.png",
    "con ca rac 2.png",
    "con rua rac.png",
    "con muc rac.png",
    "con sua rac.png",
  ];
  let darkCreatureImgs = {};
  let darkCreatures = [];

  const SEA_ZONE_BRIGHTNESS_MIN = 100;
  const SEA_ZONE_BLUE_BIAS_MIN = 30;
  const SEA_ZONE_EDGE_MARGIN_PX = 7;

  const MIN_CREATURES = 3;
  const MAX_CREATURES = 5;
  const CREATURE_PLACEMENT_TRIES = 500;
  const CREATURE_FOOTPRINT_GRID_STEPS = 4;
  const CREATURE_SPRITE_ALPHA_MIN = 20;

  const DEBUG_SHOW_SEA_ZONE = false;

  const CREATURE_ZONE_TOP_FRAC = 0.2;
  const CREATURE_ZONE_BOTTOM_FRAC = 0.57;

  let creatures = [];

  p.preload = () => {
    // Load images to get dimensions and sample pixels
    imgSky  = p.loadImage("assets/images/sky.png");
    imgSea  = p.loadImage("assets/images/sea.png");
    imgSand = p.loadImage("assets/images/sand.png");

    CREATURE_FILES.forEach((file) => {
      creatureImgs[file] = p.loadImage(
        "assets/images/" + file,
        () => {},
        () => {
          console.error(
            "Sea-creature image failed to load: assets/images/" + file
          );
        }
      );
    });

    DARK_CREATURE_FILES.forEach((file) => {
      darkCreatureImgs[file] = p.loadImage(
        "assets/images/" + file,
        () => {},
        () => {
          console.error(
            "Dark-navy 'rac' sticker failed to load: assets/images/" + file
          );
        }
      );
    });
  };

  p.setup = () => {
    computeLayout();
    const cnv = p.createCanvas(p.windowWidth, totalH);
    cnv.parent("bg-sketch");
    p.noStroke();
    seedParticles();

    seedCreatures();
    seedDarkCreatures();
  };

  p.windowResized = () => {
    computeLayout();
    p.resizeCanvas(p.windowWidth, totalH);
    seedParticles();
    seedCreatures();
    seedDarkCreatures();
  };

  function computeLayout() {
    // Calculate scale based on image widths
    scale = p.windowWidth / imgSky.width;
    hSky  = imgSky.height  * scale;
    hSand = imgSand.height * scale;
    hSea  = imgSea.height  * scale;
    
    // Canvas height = sum of all bands (no overlap/shift since HTML handles that)
    totalH = Math.round(hSky + hSand + hSea - 2300);
  }

function bandBounds() {
  const skyTop = 0;
  const skyBottom = hSky;
  
  // Overlap đơn giản
  const SAND_SKY_OVERLAP = 1600;   // Chỉnh mấy px này
  const SEA_SAND_OVERLAP = 700;   // Chỉnh mấy px này
  
  const sandTop = skyBottom - SAND_SKY_OVERLAP;
  const sandBottom = sandTop + hSand;
  
  const seaTop = sandBottom - SEA_SAND_OVERLAP;
  const seaBottom = seaTop + hSea;
  
  return { skyTop, skyBottom, sandTop, sandBottom, seaTop, seaBottom };
}

  function seedParticles() {
    const { skyTop, skyBottom, sandTop, sandBottom, seaTop, seaBottom } = bandBounds();

    bubbles = [];
    const bubbleCount = Math.max(28, Math.round((p.width * hSea) / 45000));
    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push(makeBubble(seaTop, seaBottom, true));
    }

    sparkles = [];
    const sparkleCount = Math.max(8, Math.round((p.width * hSky) / 130000));
    for (let i = 0; i < sparkleCount; i++) {
      sparkles.push({
        x: p.random(p.width),
        y: p.random(skyTop + 10, skyBottom - 10),
        r: p.random(1, 2.2),
        phase: p.random(p.TWO_PI),
        speed: p.random(0.01, 0.03),
      });
    }

    grains = [];
    const grainCount = Math.max(24, Math.round((p.width * hSand) / 60000));
    for (let i = 0; i < grainCount; i++) {
      grains.push({
        x: p.random(p.width),
        y: p.random(sandTop + 15, sandBottom - 10),
        r: p.random(0.6, 1.5),
        drift: p.random(-0.04, 0.04),
      });
    }
  }

  function makeBubble(topY, bottomY, randomStart) {
    return {
      x: p.random(p.width),
      y: randomStart ? p.random(topY, bottomY) : bottomY + p.random(20, 80),
      r: p.random(13, 19),
      speed: p.random(0.25, 0.65),
      wobble: p.random(p.TWO_PI),
      wobbleSpeed: p.random(0.01, 0.025),
      wobbleAmp: p.random(6, 16),
    };
  }

  p.draw = () => {
    p.clear();

    drawCreatures();
    drawDarkCreatures();
    if (DEBUG_SHOW_SEA_ZONE) drawSeaZoneDebug();

    drawGrain();
    drawBubbles();
    drawSparkles();
  };

  const BUBBLE_MAX_DIAMETER = 26;
  const BUBBLE_MERGE_OVERLAP_PX = 0;

  function drawBubbles() {
    const { seaTop, seaBottom } = bandBounds();

    for (const b of bubbles) {
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
    }

    for (let i = 0; i < bubbles.length; i++) {
      if (bubbles[i].y < seaTop - 20) {
        bubbles[i] = makeBubble(seaTop, seaBottom, false);
      }
    }

    mergeBubbles(seaTop, seaBottom);

    p.push();
    for (const b of bubbles) {
      const x = b.x + Math.sin(b.wobble) * b.wobbleAmp;

      p.fill(255, 255, 255, 65);
      p.circle(x, b.y, b.r);

      p.noFill();
      p.stroke(255, 255, 255, 110);
      p.strokeWeight(1);
      p.circle(x, b.y, b.r);

      p.noStroke();
      p.fill(255, 255, 255, 180);
      p.circle(x - b.r * 0.18, b.y - b.r * 0.18, b.r * 0.18);
    }
    p.pop();
  }

  function mergeBubbles(seaTop, seaBottom) {
    for (let i = 0; i < bubbles.length; i++) {
      const a = bubbles[i];
      if (!a) continue;
      for (let j = i + 1; j < bubbles.length; j++) {
        const b = bubbles[j];
        if (!b) continue;

        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const touchDist = (a.r + b.r) / 2 - BUBBLE_MERGE_OVERLAP_PX;
        if (d >= touchDist) continue;

        const areaA = a.r * a.r;
        const areaB = b.r * b.r;
        const totalArea = areaA + areaB;

        a.x = (a.x * areaA + b.x * areaB) / totalArea;
        a.y = (a.y * areaA + b.y * areaB) / totalArea;
        a.r = Math.min(BUBBLE_MAX_DIAMETER, Math.sqrt(areaA + areaB));
        a.speed = (a.speed * areaA + b.speed * areaB) / totalArea;
        a.wobbleAmp = (a.wobbleAmp * areaA + b.wobbleAmp * areaB) / totalArea;
        a.wobbleSpeed = (a.wobbleSpeed * areaA + b.wobbleSpeed * areaB) / totalArea;

        bubbles[j] = makeBubble(seaTop, seaBottom, false);
      }
    }
  }

  function drawSparkles() {
    p.push();
    for (const s of sparkles) {
      s.phase += s.speed;
      const alpha = 90 + Math.sin(s.phase) * 70;
      p.fill(255, 255, 255, Math.max(0, alpha));
      p.circle(s.x, s.y, s.r);
    }
    p.pop();
  }

  function drawGrain() {
    p.push();
    for (const g of grains) {
      g.x += g.drift;
      if (g.x < 0) g.x = p.width;
      if (g.x > p.width) g.x = 0;
      p.fill(120, 90, 50, 30);
      p.circle(g.x, g.y, g.r);
    }
    p.pop();
  }

  // ================================================================
  // Sea-creature placement + draw
  // ================================================================

  function isLightBlueWater(x, y) {
    const { seaTop } = bandBounds();
    const imgX = Math.round(x / scale);
    const imgY = Math.round((y - seaTop) / scale);

    if (imgX < 0 || imgX >= imgSea.width || imgY < 0 || imgY >= imgSea.height) {
      return false;
    }

    const c = imgSea.get(imgX, imgY);
    const brightness = (c[0] + c[1] + c[2]) / 3;
    const blueBias = c[2] - c[0];

    return brightness > SEA_ZONE_BRIGHTNESS_MIN && blueBias > SEA_ZONE_BLUE_BIAS_MIN;
  }

  function isSafeWater(x, y) {
    const m = SEA_ZONE_EDGE_MARGIN_PX;
    return (
      isLightBlueWater(x, y) &&
      isLightBlueWater(x - m, y) &&
      isLightBlueWater(x + m, y) &&
      isLightBlueWater(x, y - m) &&
      isLightBlueWater(x, y + m)
    );
  }

  function footprintInsideWater(cx, cy, w, h, img, rotation) {
    const steps = CREATURE_FOOTPRINT_GRID_STEPS;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    for (let iy = 0; iy <= steps; iy++) {
      for (let ix = 0; ix <= steps; ix++) {
        const u = ix / steps;
        const v = iy / steps;

        const spX = Math.min(img.width - 1, Math.round(u * img.width));
        const spY = Math.min(img.height - 1, Math.round(v * img.height));
        const alpha = img.get(spX, spY)[3];
        if (alpha < CREATURE_SPRITE_ALPHA_MIN) continue;

        const lx = -w / 2 + u * w;
        const ly = -h / 2 + v * h;
        const px = cx + lx * cosR - ly * sinR;
        const py = cy + lx * sinR + ly * cosR;
        if (!isSafeWater(px, py)) return false;
      }
    }
    return true;
  }

  function shuffledCopy(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(p.random(i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const CREATURE_SIDEWAYS_JITTER_FRAC = 0.35;

  function measureWaterRowAt(y) {
    const step = 4;
    let minX = null, maxX = null;
    for (let x = 0; x <= p.width; x += step) {
      if (isLightBlueWater(x, y)) {
        if (minX === null) minX = x;
        maxX = x;
      }
    }
    if (minX === null) return null;
    return { minX, maxX, centerX: (minX + maxX) / 2 };
  }

  function seedCreatures() {
    creatures = [];

    const count = Math.floor(p.random(MIN_CREATURES, MAX_CREATURES + 1));
    const chosenFiles = shuffledCopy(CREATURE_FILES).slice(0, count);

    const { seaTop, seaBottom } = bandBounds();
    const seaH = seaBottom - seaTop;

    const zoneTop = seaTop + CREATURE_ZONE_TOP_FRAC * seaH;
    const zoneBottom = seaTop + CREATURE_ZONE_BOTTOM_FRAC * seaH;
    const zoneH = Math.max(1, zoneBottom - zoneTop);

    const sliceOrder = shuffledCopy(chosenFiles.map((_, i) => i));

    chosenFiles.forEach((file, idx) => {
      const img = creatureImgs[file];
      const SCALE = 0.9;
      const w = img.width * SCALE;
      const h = img.height * SCALE;
      const radius = Math.hypot(w, h) / 2;

      const sliceIndex = sliceOrder[idx];
      const sliceTop = zoneTop + (sliceIndex / count) * zoneH;
      const sliceBottom = zoneTop + ((sliceIndex + 1) / count) * zoneH;

      const padY = Math.min((sliceBottom - sliceTop) * 0.02, h * 0.1);
      const rowMin = Math.max(sliceTop + padY, seaTop + h / 2);
      const rowMax = Math.min(sliceBottom - padY, seaBottom - h / 2);

      let placed = false;
      for (let attempt = 0; attempt < CREATURE_PLACEMENT_TRIES && !placed; attempt++) {
        const cy = rowMin <= rowMax
          ? p.random(rowMin, rowMax)
          : p.random(Math.max(zoneTop, seaTop + h / 2), Math.min(zoneBottom, seaBottom - h / 2));

        const row = measureWaterRowAt(cy);
        let cx;
        if (row) {
          const halfSpan = (row.maxX - row.minX) * CREATURE_SIDEWAYS_JITTER_FRAC;
          cx = p.constrain(
            row.centerX + p.random(-halfSpan, halfSpan),
            w / 2,
            p.width - w / 2
          );
        } else {
          cx = p.random(w / 2, p.width - w / 2);
        }

        const rotation = p.random(-p.PI / 12, p.PI / 12);
        if (!footprintInsideWater(cx, cy, w, h, img, rotation)) continue;

        const overlapsExisting = creatures.some((other) => {
          const d = Math.hypot(cx - other.x, cy - other.y);
          return d < (radius + other.radius) * 0.9;
        });
        if (overlapsExisting) continue;

        creatures.push({
          img,
          x: cx,
          y: cy,
          w,
          h,
          radius,
          rotation,
          bobPhase: p.random(p.TWO_PI),
          bobSpeed: p.random(0.01, 0.02),
          bobAmp: p.random(2, 5),
        });
        placed = true;
      }
    });

    compressCreatures(creatures, 2);
  }

  function compressCreatures(creatures, minGap = 2) {
    creatures.sort((a, b) => a.y - b.y);
    for (let i = 1; i < creatures.length; i++) {
      const prev = creatures[i - 1];
      const curr = creatures[i];
      const d = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const minDist = prev.radius + curr.radius + minGap;
      if (d > minDist * 1.5) {
        const ratio = minDist / d;
        curr.x = prev.x + (curr.x - prev.x) * ratio;
        curr.y = prev.y + (curr.y - prev.y) * ratio;
      }
    }
  }

  function drawCreatures() {
    p.push();
    p.imageMode(p.CENTER);
    for (const c of creatures) {
      c.bobPhase += c.bobSpeed;
      const dy = Math.sin(c.bobPhase) * c.bobAmp;

      p.push();
      p.translate(c.x, c.y + dy);
      p.rotate(c.rotation);
      p.image(c.img, 0, 0, c.w, c.h);
      p.pop();
    }
    p.pop();
    p.imageMode(p.CORNER);
  }

  function drawSeaZoneDebug() {
    const { seaTop, seaBottom } = bandBounds();
    const step = 6;
    p.push();
    p.noStroke();
    p.fill(255, 0, 255, 90);
    for (let y = seaTop; y < seaBottom; y += step) {
      for (let x = 0; x < p.width; x += step) {
        if (isLightBlueWater(x, y)) {
          p.rect(x, y, step, step);
        }
      }
    }
    p.pop();
  }

  // ================================================================
  // Dark-navy "rac" creature placement + draw
  // ================================================================

  const DARK_ZONE_BRIGHTNESS_MAX = 90;
  const DARK_ZONE_BLUE_BIAS_MIN = 8;
  const DARK_ZONE_EDGE_MARGIN_PX = 7;

  const MIN_DARK_CREATURES = 5;
  const MAX_DARK_CREATURES = 7;
  const DARK_CREATURE_PLACEMENT_TRIES = 500;

  const DARK_CREATURE_ZONE_TOP_FRAC = 0.22;
  const DARK_CREATURE_ZONE_BOTTOM_FRAC = 0.55;

  function isDarkNavyWater(x, y) {
    const { seaTop } = bandBounds();
    const imgX = Math.round(x / scale);
    const imgY = Math.round((y - seaTop) / scale);

    if (imgX < 0 || imgX >= imgSea.width || imgY < 0 || imgY >= imgSea.height) {
      return false;
    }

    const c = imgSea.get(imgX, imgY);
    const brightness = (c[0] + c[1] + c[2]) / 3;
    const blueBias = c[2] - c[0];

    return brightness < DARK_ZONE_BRIGHTNESS_MAX && blueBias > DARK_ZONE_BLUE_BIAS_MIN;
  }

  function isSafeDarkWater(x, y) {
    const m = DARK_ZONE_EDGE_MARGIN_PX;
    return (
      isDarkNavyWater(x, y) &&
      isDarkNavyWater(x - m, y) &&
      isDarkNavyWater(x + m, y) &&
      isDarkNavyWater(x, y - m) &&
      isDarkNavyWater(x, y + m)
    );
  }

  function footprintInsideDarkWater(cx, cy, w, h, img, rotation) {
    const steps = CREATURE_FOOTPRINT_GRID_STEPS;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    for (let iy = 0; iy <= steps; iy++) {
      for (let ix = 0; ix <= steps; ix++) {
        const u = ix / steps;
        const v = iy / steps;

        const spX = Math.min(img.width - 1, Math.round(u * img.width));
        const spY = Math.min(img.height - 1, Math.round(v * img.height));
        const alpha = img.get(spX, spY)[3];
        if (alpha < CREATURE_SPRITE_ALPHA_MIN) continue;

        const lx = -w / 2 + u * w;
        const ly = -h / 2 + v * h;
        const px = cx + lx * cosR - ly * sinR;
        const py = cy + lx * sinR + ly * cosR;
        if (!isSafeDarkWater(px, py)) return false;
      }
    }
    return true;
  }

  function seedDarkCreatures() {
    darkCreatures = [];

    const count = Math.floor(p.random(MIN_DARK_CREATURES, MAX_DARK_CREATURES + 1));
    const chosenFiles = shuffledCopy(DARK_CREATURE_FILES).slice(0, count);

    const { seaTop, seaBottom } = bandBounds();
    const seaH = seaBottom - seaTop;

    const zoneTop = seaTop + DARK_CREATURE_ZONE_TOP_FRAC * seaH;
    const zoneBottom = seaTop + DARK_CREATURE_ZONE_BOTTOM_FRAC * seaH;
    const zoneH = Math.max(1, zoneBottom - zoneTop);

    const sliceOrder = shuffledCopy(chosenFiles.map((_, i) => i));

    chosenFiles.forEach((file, idx) => {
      const img = darkCreatureImgs[file];
      const w = img.width;
      const h = img.height;
      const radius = Math.hypot(w, h) / 2;

      const sliceIndex = sliceOrder[idx];
      const sliceTop = zoneTop + (sliceIndex / count) * zoneH;
      const sliceBottom = zoneTop + ((sliceIndex + 1) / count) * zoneH;
      const padY = Math.min((sliceBottom - sliceTop) * 0.02, h * 0.1);
      const rowMin = Math.max(sliceTop + padY, seaTop + h / 2);
      const rowMax = Math.min(sliceBottom - padY, seaBottom - h / 2);

      let placed = false;
      for (let attempt = 0; attempt < DARK_CREATURE_PLACEMENT_TRIES && !placed; attempt++) {
        const cy = rowMin <= rowMax
          ? p.random(rowMin, rowMax)
          : p.random(Math.max(zoneTop, seaTop + h / 2), Math.min(zoneBottom, seaBottom - h / 2));

        const cx = p.random(w / 2, p.width - w / 2);
        const rotation = p.random(-p.PI / 10, p.PI / 10);

        if (!footprintInsideDarkWater(cx, cy, w, h, img, rotation)) continue;

        const overlapsExisting = darkCreatures.some((other) => {
          const d = Math.hypot(cx - other.x, cy - other.y);
          return d < radius + other.radius;
        });
        if (overlapsExisting) continue;

        const overlapsLightCreatures = creatures.some((other) => {
          const d = Math.hypot(cx - other.x, cy - other.y);
          return d < radius + other.radius;
        });
        if (overlapsLightCreatures) continue;

        darkCreatures.push({
          img,
          x: cx,
          y: cy,
          w,
          h,
          radius,
          rotation,
          bobPhase: p.random(p.TWO_PI),
          bobSpeed: p.random(0.01, 0.02),
          bobAmp: p.random(2, 5),
        });
        placed = true;
      }
    });
  }

  function drawDarkCreatures() {
    p.push();
    p.imageMode(p.CENTER);
    for (const c of darkCreatures) {
      c.bobPhase += c.bobSpeed;
      const dy = Math.sin(c.bobPhase) * c.bobAmp;

      p.push();
      p.translate(c.x, c.y + dy);
      p.rotate(c.rotation);
      p.image(c.img, 0, 0, c.w, c.h);
      p.pop();
    }
    p.pop();
    p.imageMode(p.CORNER);
  }
};

new p5(sketch);