// ===============================================================
// Ocean background
// ===============================================================

const sketch = (p) => {
  let imgBg;
  let scale = 1;
  let totalH = 0;

  const SKY_BAND_FRAC = 0.25;
  const SAND_BAND_FRAC = 0.39;

  let bubbles = [];
  let sparkles = [];
  let grains = [];

  // ----------------------------------------------------------------
  // Sea-creature stickers (fish, turtle, jellyfish, etc.)
  // They only show up inside the light-blue "river" part of the sea.
  // Random pick + random spot every time the page loads.
  // ----------------------------------------------------------------

  let creatureImgs = {};

  // ocean creature sticker filenames
  const CREATURE_FILES = [
    "con ca duoi.png",  // stingray
    "con ca heo.png",   // dolphin
    "con ca mup.png",   // shark
    "con ca ngua.png",  // seahorse
    "con muc.png",      // squid
    "con rua.png",      // turtle
    "con sua.png",      // jellyfish
    "ngoi sao.png",     // starfish 
  ];

  // trash creature sticker filenames
  const TRASH_CREATURE_FILES = [
    "con bach tuot rac.png",  // dumbo octopus - trash version
    "con ca heo rac.png",     // dolphin - trash version
    "con ca rac.png",         // fish - trash version 1
    "con ca rac 2.png",       // fish - trash version 2
    "con rua rac.png",        // turtle - trash version
    "con muc rac.png",        // squid - trash version
    "con sua rac.png",        // jellyfish - trash version
  ];
  let TRASHCreatureImgs = {};
  let TRASHCreatures = [];

  // used to find the light-blue water by checking pixel colors on background.png
  const SEA_ZONE_BRIGHTNESS_MIN = 100;
  const SEA_ZONE_BLUE_BIAS_MIN = 30;

  // small buffer so creatures don't spawn right on the water's edge
  const SEA_ZONE_EDGE_MARGIN_PX = 7;

  const MIN_CREATURES = 3;
  const MAX_CREATURES = 5;
  const CREATURE_GAP_PX_AT_1000 = 0;

  const CREATURE_PLACEMENT_TRIES = 500; // how many random spots to try before giving up

  // how many grid points we check to see if a sprite fits in the water
  const CREATURE_FOOTPRINT_GRID_STEPS = 4;
  const CREATURE_SPRITE_ALPHA_MIN = 20;

  // set to true to see the detected water zone drawn as a color overlay (for testing)
  const DEBUG_SHOW_SEA_ZONE = false;

  // creatures can only spawn between these two heights (as a % of the sea area)
  const CREATURE_ZONE_TOP_FRAC = 0.2;
  const CREATURE_ZONE_BOTTOM_FRAC = 0.5;

  let creatures = [];

  p.preload = () => {
    imgBg = p.loadImage("assets/images/background.png");

    // load every sea creature image, print an error in the console if one is missing
    for (let i = 0; i < CREATURE_FILES.length; i++) {
      const file = CREATURE_FILES[i];
      creatureImgs[file] = p.loadImage(
        "assets/images/" + file,
        function () {}, // loaded ok, nothing else to do
        function () {
          console.error("Sea-creature image failed to load: assets/images/" + file);
        }
      );
    }

    // same thing for the trash sticker set
    for (let i = 0; i < TRASH_CREATURE_FILES.length; i++) {
      const file = TRASH_CREATURE_FILES[i];
      TRASHCreatureImgs[file] = p.loadImage(
        "assets/images/" + file,
        function () {},
        function () {
          console.error("Trash sticker failed to load: assets/images/" + file);
        }
      );
    }
  };

  p.setup = () => {
    computeLayout();
    const cnv = p.createCanvas(p.windowWidth, totalH);
    cnv.parent("bg-sketch");
    p.noStroke();
    seedParticles();

    // pick a random set of sea creatures and place them
    seedCreatures();
    seedTRASHCreatures();
  };

  // Called on window resize to recompute the layout and re-seed particles and creatures.
  p.windowResized = () => {
    computeLayout();
    p.resizeCanvas(p.windowWidth, totalH);
    seedParticles();

    // the water zone can move when the page is resized, so re-place
    // the creatures to match
    seedCreatures();
    seedTRASHCreatures();
  };

  // works out the scale + total canvas height based on the window width
  function computeLayout() {
    scale = p.windowWidth / imgBg.width;
    totalH = Math.round(imgBg.height * scale);
  }

  // order top -> bottom: sky, sand, sea — three vertical slices of
  // the one merged image, sized by the fractions above
  function bandBounds() {
    const skyTop = 0;
    const skyBottom = totalH * SKY_BAND_FRAC;
    const sandTop = skyBottom;
    const sandBottom = totalH * SAND_BAND_FRAC;
    const seaTop = sandBottom;
    const seaBottom = totalH;
    return { skyTop, skyBottom, sandTop, sandBottom, seaTop, seaBottom };
  }

  // ================================================================
  // Particle system: bubbles, sparkles, grains
  // ================================================================
  function seedParticles() {
    const bounds = bandBounds();
    const skyTop = bounds.skyTop;
    const skyBottom = bounds.skyBottom;
    const sandTop = bounds.sandTop;
    const sandBottom = bounds.sandBottom;
    const seaTop = bounds.seaTop;
    const seaBottom = bounds.seaBottom;

    bubbles = [];
    const bubbleCount = Math.max(40, Math.round((p.width * (seaBottom - seaTop)) / 20000));
    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push(makeBubble(seaTop, seaBottom, true));
    }

    sparkles = [];
    const sparkleCount = Math.max(8, Math.round((p.width * (skyBottom - skyTop)) / 130000));
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
    const grainCount = Math.max(24, Math.round((p.width * (sandBottom - sandTop)) / 60000));
    for (let i = 0; i < grainCount; i++) {
      grains.push({
        x: p.random(p.width),
        y: p.random(sandTop + 15, sandBottom - 10),
        r: p.random(0.6, 1.5),
        drift: p.random(-0.04, 0.04),
      });
    }
  }

  // makes one bubble. if randomStart is true it can start anywhere in the sea
  // band, otherwise it starts just below the bottom (used when respawning)
  function makeBubble(topY, bottomY, randomStart) {
    let startY;
    if (randomStart) {
      startY = p.random(topY, bottomY);
    } else {
      startY = bottomY + p.random(20, 80);
    }

    return {
      x: p.random(p.width),
      y: startY,
      r: p.random(13, 19),
      speed: p.random(0.25, 0.65),
      wobble: p.random(p.TWO_PI),
      wobbleSpeed: p.random(0.01, 0.025),
      wobbleAmp: p.random(6, 16),
    };
  }

  // main draw loop: clears the canvas, draws the background, then
  // draws creatures and particles on top of it
  p.draw = () => {
    p.clear();
    drawLayers();

    drawCreatures();
    drawTRASHCreatures();
    if (DEBUG_SHOW_SEA_ZONE) drawSeaZoneDebug();

    drawGrain();
    drawBubbles();
    drawSparkles();
  };

  // draws the background image with a slow floating sway effect
  function drawLayers() {
    const t = p.frameCount;
    const bgDy = Math.sin(t * 0.003 + 2.1) * 3;
    p.image(imgBg, 0, bgDy, p.width, totalH);
  }

  // bubble settings
  const BUBBLE_MAX_DIAMETER = 26;
  const BUBBLE_MERGE_OVERLAP_PX = 0;

  function drawBubbles() {
    const bounds = bandBounds();
    const seaTop = bounds.seaTop;
    const seaBottom = bounds.seaBottom;

    // move every bubble up a little, and update its wobble
    for (const b of bubbles) {
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
    }

    // if a bubble floated past the top of the sea, respawn it at the bottom
    for (let i = 0; i < bubbles.length; i++) {
      if (bubbles[i].y < seaTop - 20) {
        bubbles[i] = makeBubble(seaTop, seaBottom, false);
      }
    }

    // merge bubbles that are touching into one bigger bubble
    mergeBubbles(seaTop, seaBottom);

    p.push();
    for (const b of bubbles) {
      const x = b.x + Math.sin(b.wobble) * b.wobbleAmp;

      // bubble body
      p.fill(255, 255, 255, 65);
      p.circle(x, b.y, b.r);

      // bubble outline
      p.noFill();
      p.stroke(255, 255, 255, 110);
      p.strokeWeight(1);
      p.circle(x, b.y, b.r);

      // little shine spot
      p.noStroke();
      p.fill(255, 255, 255, 180);
      p.circle(x - b.r * 0.18, b.y - b.r * 0.18, b.r * 0.18);

      p.noStroke();
    }
    p.pop();
  }

  // checks every pair of bubbles and merges the ones that are touching
  function mergeBubbles(seaTop, seaBottom) {
    for (let i = 0; i < bubbles.length; i++) {
      const a = bubbles[i];
      if (!a) continue;
      for (let j = i + 1; j < bubbles.length; j++) {
        const b = bubbles[j];
        if (!b) continue;

        // use the on-screen x (with wobble added), same as what drawBubbles()
        // actually draws, so "touching" here matches what the eye sees
        const ax = a.x + Math.sin(a.wobble) * a.wobbleAmp;
        const bx = b.x + Math.sin(b.wobble) * b.wobbleAmp;

        const d = Math.hypot(ax - bx, a.y - b.y);
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
  // Creature placement + draw
  // ================================================================

  // checks if the pixel at (x, y) is light-blue water, by reading the
  // real pixel color from background.png
  function isLightBlueWater(x, y) {
    // turn the canvas x/y into the matching pixel on background.png
    const imgX = Math.round(x / scale);
    const imgY = Math.round(y / scale);

    if (imgX < 0 || imgX >= imgBg.width || imgY < 0 || imgY >= imgBg.height) {
      return false; // outside the image
    }

    const c = imgBg.get(imgX, imgY); // [r, g, b, a]
    const brightness = (c[0] + c[1] + c[2]) / 3;
    const blueBias = c[2] - c[0]; // how much bluer than red

    return brightness > SEA_ZONE_BRIGHTNESS_MIN && blueBias > SEA_ZONE_BLUE_BIAS_MIN;
  }

  // same check as above, but also checks 4 points around it, so
  // creatures don't spawn right on the edge of the water
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

  // checks a grid of points across the sprite and makes sure every
  // non-transparent point of it lands on safe water
  function footprintInsideWater(cx, cy, w, h, img, rotation) {
    const steps = CREATURE_FOOTPRINT_GRID_STEPS;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    for (let iy = 0; iy <= steps; iy++) {
      for (let ix = 0; ix <= steps; ix++) {
        const u = ix / steps;
        const v = iy / steps;

        // check the sprite's own pixel here first — skip transparent spots
        const spX = Math.min(img.width - 1, Math.round(u * img.width));
        const spY = Math.min(img.height - 1, Math.round(v * img.height));
        const alpha = img.get(spX, spY)[3];
        if (alpha < CREATURE_SPRITE_ALPHA_MIN) continue;

        // work out where this point actually lands on the canvas, after rotation
        const lx = -w / 2 + u * w;
        const ly = -h / 2 + v * h;
        const px = cx + lx * cosR - ly * sinR;
        const py = cy + lx * sinR + ly * cosR;
        if (!isSafeWater(px, py)) return false;
      }
    }
    return true;
  }

  // shuffles a copy of an array (Fisher-Yates), used to pick random creatures
  function shuffledCopy(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(p.random(i + 1));
      const temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
    return a;
  }

  // how far left/right a creature can drift from the river's centerline
  const CREATURE_SIDEWAYS_JITTER_FRAC = 0.35;

  // scans across the page at a given y and finds the left/right edge
  // + center of the water there
  function measureWaterRowAt(y) {
    const step = 4;
    let minX = null;
    let maxX = null;
    for (let x = 0; x <= p.width; x += step) {
      if (isLightBlueWater(x, y)) {
        if (minX === null) minX = x;
        maxX = x;
      }
    }
    if (minX === null) return null;
    return { minX: minX, maxX: maxX, centerX: (minX + maxX) / 2 };
  }

  // picks a random set of sea creatures and places them in the water
  function seedCreatures() {
    creatures = [];

    const count = Math.floor(p.random(MIN_CREATURES, MAX_CREATURES + 1));
    const chosenFiles = shuffledCopy(CREATURE_FILES).slice(0, count);
    const gapPx = (CREATURE_GAP_PX_AT_1000 / 1000) * p.width; // scales with page width

    const bounds = bandBounds();
    const seaTop = bounds.seaTop;
    const seaBottom = bounds.seaBottom;
    const seaH = seaBottom - seaTop;

    // work out the pixel range creatures are allowed to spawn in
    const zoneTop = seaTop + CREATURE_ZONE_TOP_FRAC * seaH;
    const zoneBottom = seaTop + CREATURE_ZONE_BOTTOM_FRAC * seaH;
    const zoneH = Math.max(1, zoneBottom - zoneTop);

    // give each creature its own slice of the zone, in random order,
    // so they spread out and don't clump up
    const slotNumbers = [];
    for (let i = 0; i < chosenFiles.length; i++) {
      slotNumbers.push(i);
    }
    const sliceOrder = shuffledCopy(slotNumbers);

    for (let idx = 0; idx < chosenFiles.length; idx++) {
      const file = chosenFiles[idx];
      const img = creatureImgs[file];
      const SCALE = 0.9;
      const w = img.width * SCALE;
      const h = img.height * SCALE;
      const radius = Math.hypot(w, h) / 2; // rough radius, used for overlap checks

      const sliceIndex = sliceOrder[idx];
      const sliceTop = zoneTop + (sliceIndex / count) * zoneH;
      const sliceBottom = zoneTop + ((sliceIndex + 1) / count) * zoneH;

      // small gap so the sprite doesn't sit flush on the slice edge
      const padY = Math.min((sliceBottom - sliceTop) * 0, h * 0.1);
      const rowMin = Math.max(sliceTop + padY, seaTop + h / 2);
      const rowMax = Math.min(sliceBottom - padY, seaBottom - h / 2);

      let placed = false;
      for (let attempt = 0; attempt < CREATURE_PLACEMENT_TRIES && !placed; attempt++) {
        let cy;
        if (rowMin <= rowMax) {
          cy = p.random(rowMin, rowMax);
        } else {
          cy = p.random(Math.max(zoneTop, seaTop + h / 2), Math.min(zoneBottom, seaBottom - h / 2));
        }

        const row = measureWaterRowAt(cy);
        let cx;
        if (row) {
          const halfSpan = (row.maxX - row.minX) * CREATURE_SIDEWAYS_JITTER_FRAC;
          cx = p.constrain(row.centerX + p.random(-halfSpan, halfSpan), w / 2, p.width - w / 2);
        } else {
          cx = p.random(w / 2, p.width - w / 2);
        }

        const rotation = p.random(-p.PI / 12, p.PI / 12);

        if (!footprintInsideWater(cx, cy, w, h, img, rotation)) continue;

        // check this spot isn't too close to a creature already placed
        let overlapsExisting = false;
        for (let k = 0; k < creatures.length; k++) {
          const other = creatures[k];
          const d = Math.hypot(cx - other.x, cy - other.y);
          if (d < (radius + other.radius) * 0.9) {
            overlapsExisting = true;
            break;
          }
        }
        if (overlapsExisting) continue;

        creatures.push({
          img: img,
          x: cx,
          y: cy,
          w: w,
          h: h,
          radius: radius,
          rotation: rotation,
          bobPhase: p.random(p.TWO_PI), // random starting point for the bobbing motion
          bobSpeed: p.random(0.01, 0.02),
          bobAmp: p.random(2, 5),
        });
        placed = true;
      }
    }
  }

  // pulls creatures closer together if they ended up too far apart,
  // so there's no huge gap between them
  // (note: not currently called anywhere, kept here in case it's needed later)
  function compressCreatures(creatures, minGap) {
    if (minGap === undefined) minGap = 2;

    creatures.sort(function (a, b) {
      return a.y - b.y;
    });

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

  // draws every placed creature with a light up-and-down bobbing motion
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

  // draws a color overlay over every detected water pixel, for testing only
  function drawSeaZoneDebug() {
    const bounds = bandBounds();
    const seaTop = bounds.seaTop;
    const seaBottom = bounds.seaBottom;
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
  // Trash-creature placement + draw
  // ================================================================

  const TRASH_ZONE_BRIGHTNESS_MAX = 90;
  const TRASH_ZONE_BLUE_BIAS_MIN = 8;
  const TRASH_ZONE_EDGE_MARGIN_PX = 7;

  const MIN_TRASH_CREATURES = 5;
  const MAX_TRASH_CREATURES = 7;
  const TRASH_CREATURE_PLACEMENT_TRIES = 500;

  const TRASH_CREATURE_ZONE_TOP_FRAC = 0.2;
  const TRASH_CREATURE_ZONE_BOTTOM_FRAC = 0.5;

  // checks if a pixel is dark-navy water (the deep sea color, not the light-blue river)
  function isDARKNAVYWater(x, y) {
    const imgX = Math.round(x / scale);
    const imgY = Math.round(y / scale);

    if (imgX < 0 || imgX >= imgBg.width || imgY < 0 || imgY >= imgBg.height) {
      return false;
    }

    const c = imgBg.get(imgX, imgY);
    const brightness = (c[0] + c[1] + c[2]) / 3;
    const blueBias = c[2] - c[0];

    return brightness < TRASH_ZONE_BRIGHTNESS_MAX && blueBias > TRASH_ZONE_BLUE_BIAS_MIN;
  }

  function isSafeTRASHWater(x, y) {
    const m = TRASH_ZONE_EDGE_MARGIN_PX;
    return (
      isDARKNAVYWater(x, y) &&
      isDARKNAVYWater(x - m, y) &&
      isDARKNAVYWater(x + m, y) &&
      isDARKNAVYWater(x, y - m) &&
      isDARKNAVYWater(x, y + m)
    );
  }

  // same idea as footprintInsideWater(), but checking the dark-navy zone instead
  function footprintInsideTRASHWater(cx, cy, w, h, img, rotation) {
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
        if (!isSafeTRASHWater(px, py)) return false;
      }
    }
    return true;
  }

  // picks a random set of trash stickers and places them in the dark-navy area
  function seedTRASHCreatures() {
    TRASHCreatures = [];

    const count = Math.floor(p.random(MIN_TRASH_CREATURES, MAX_TRASH_CREATURES + 1));
    const chosenFiles = shuffledCopy(TRASH_CREATURE_FILES).slice(0, count);

    const bounds = bandBounds();
    const seaTop = bounds.seaTop;
    const seaBottom = bounds.seaBottom;
    const seaH = seaBottom - seaTop;

    const zoneTop = seaTop + TRASH_CREATURE_ZONE_TOP_FRAC * seaH;
    const zoneBottom = seaTop + TRASH_CREATURE_ZONE_BOTTOM_FRAC * seaH;
    const zoneH = Math.max(1, zoneBottom - zoneTop);

    const slotNumbers = [];
    for (let i = 0; i < chosenFiles.length; i++) {
      slotNumbers.push(i);
    }
    const sliceOrder = shuffledCopy(slotNumbers);

    for (let idx = 0; idx < chosenFiles.length; idx++) {
      const file = chosenFiles[idx];
      const img = TRASHCreatureImgs[file];
      const w = img.width; // keep original size, no scaling
      const h = img.height;
      const radius = Math.hypot(w, h) / 2;

      const sliceIndex = sliceOrder[idx];
      const sliceTop = zoneTop + (sliceIndex / count) * zoneH;
      const sliceBottom = zoneTop + ((sliceIndex + 1) / count) * zoneH;
      const padY = Math.min((sliceBottom - sliceTop) * 0.02, h * 0.1);
      const rowMin = Math.max(sliceTop + padY, seaTop + h / 2);
      const rowMax = Math.min(sliceBottom - padY, seaBottom - h / 2);

      let placed = false;
      for (let attempt = 0; attempt < TRASH_CREATURE_PLACEMENT_TRIES && !placed; attempt++) {
        let cy;
        if (rowMin <= rowMax) {
          cy = p.random(rowMin, rowMax);
        } else {
          cy = p.random(Math.max(zoneTop, seaTop + h / 2), Math.min(zoneBottom, seaBottom - h / 2));
        }

        // the dark-navy area covers most of the page width, so just
        // pick a random x — the water check below filters out bad spots
        const cx = p.random(w / 2, p.width - w / 2);
        const rotation = p.random(-p.PI / 10, p.PI / 10);

        if (!footprintInsideTRASHWater(cx, cy, w, h, img, rotation)) continue;

        let overlapsExisting = false;
        for (let k = 0; k < TRASHCreatures.length; k++) {
          const other = TRASHCreatures[k];
          const d = Math.hypot(cx - other.x, cy - other.y);
          if (d < radius + other.radius) {
            overlapsExisting = true;
            break;
          }
        }
        if (overlapsExisting) continue;

        // also stay away from the light-blue river creatures so the two
        // sticker sets never end up on top of each other
        let overlapsLightCreatures = false;
        for (let k = 0; k < creatures.length; k++) {
          const other = creatures[k];
          const d = Math.hypot(cx - other.x, cy - other.y);
          if (d < radius + other.radius) {
            overlapsLightCreatures = true;
            break;
          }
        }
        if (overlapsLightCreatures) continue;

        TRASHCreatures.push({
          img: img,
          x: cx,
          y: cy,
          w: w,
          h: h,
          radius: radius,
          rotation: rotation,
          bobPhase: p.random(p.TWO_PI),
          bobSpeed: p.random(0.01, 0.02),
          bobAmp: p.random(2, 5),
        });
        placed = true;
      }
      // if it never found a free spot, it's just skipped
    }
  }

  // draws the trash stickers with the same light bobbing motion as the creatures
  function drawTRASHCreatures() {
    p.push();
    p.imageMode(p.CENTER);
    for (const c of TRASHCreatures) {
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
