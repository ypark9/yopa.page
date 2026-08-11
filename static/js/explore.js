(() => {
  const canvas = document.getElementById("explore-world");
  const stage = document.querySelector(".atlas-stage");
  const shell = document.getElementById("explore-shell");
  const nightFilter = document.getElementById("atlas-night-filter");
  const payload = document.getElementById("explore-posts");
  const layerCanvases = {
    backdrop: document.getElementById("atlas-backdrop"),
    base: document.getElementById("atlas-base"),
    world: document.getElementById("atlas-world"),
    top: document.getElementById("atlas-top"),
    night: document.getElementById("atlas-night-art"),
    cursor: canvas
  };
  if (!canvas || !stage || !shell || !nightFilter || !payload || Object.values(layerCanvases).some((item) => !item)) return;

  const layerContexts = Object.fromEntries(
    Object.entries(layerCanvases).map(([name, item]) => [name, item.getContext("2d")])
  );
  let ctx = layerContexts.world;
  const posts = JSON.parse(payload.textContent || "[]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  const configuredScheme = document.documentElement.dataset.userColorScheme;
  const initialDarkMode = configuredScheme ? configuredScheme === "dark" : colorSchemeMedia.matches;
  document.body.classList.toggle("atlas-night-mode", initialDarkMode);
  const SESSION_KEY = "article-atlas-navigation-v1";
  const PIT_SESSION_KEY = "article-atlas-server-cost-pit-v1";
  const PIT_DELAY_SECONDS = 60;
  const SIGNPOST_INTERACTION_RADIUS = 58;
  const atlasImages = new Map();
  let atlasManifest = null;
  let riveOcean = null;
  let riveOceanStatus = "idle";
  let riveOceanCanvas = null;
  const atlasAssetRoot = new URL(stage.dataset.atlasAssets || "", location.href);
  const world = { minX: -3584, maxX: 3584, minY: -768, maxY: 4352 };
  const palette = {
    cloud: { name: "Cloud Highlands", fill: "#d8e6cf", edge: "#7aa17b", beacon: "#ff8b5c" },
    agents: { name: "Agent Grove", fill: "#b9d9c1", edge: "#568b68", beacon: "#ffe37b" },
    code: { name: "Codeworks", fill: "#d8d1b6", edge: "#8f8260", beacon: "#f58c77" },
    salesforce: { name: "Salesforce Springs", fill: "#b9d9dc", edge: "#568f99", beacon: "#ffd873" },
    python: { name: "Python Meadow", fill: "#d9dba9", edge: "#8d9156", beacon: "#ed8a65" },
    engineering: { name: "Engineering Ridge", fill: "#c9c4dc", edge: "#777091", beacon: "#ffb36f" },
    archive: { name: "Archive Harbor", fill: "#c5ddd8", edge: "#668e87", beacon: "#f3979f" }
  };
  const regions = [
    { id: "cloud", x: -2468, y: 250, rx: 830, ry: 650 },
    { id: "agents", x: 470, y: 296, rx: 790, ry: 680 },
    { id: "engineering", x: 2518, y: 330, rx: 760, ry: 620 },
    { id: "code", x: -2488, y: 1958, rx: 850, ry: 720 },
    { id: "salesforce", x: 470, y: 2034, rx: 760, ry: 650 },
    { id: "python", x: 2120, y: 1960, rx: 700, ry: 600 },
    { id: "archive", x: 132, y: 3208, rx: 660, ry: 430 }
  ];
  const state = {
    width: 0, height: 0, dpr: 1,
    camera: { x: 0, y: 0 },
    pointer: { x: innerWidth / 2, y: innerHeight / 2, active: false, mapActive: false, type: "mouse" },
    entered: false,
    paused: false,
    wheelOpen: false,
    nearest: null,
    lockedTarget: null,
    waypoint: null,
    nearbyLandmark: null,
    pointerGesture: null,
    suppressNextClick: false,
    visitedRegions: new Set(),
    activeSeconds: 0,
    lastTick: null,
    pitOpen: false,
    time: 0,
    motionTime: 0,
    nightAmount: initialDarkMode ? 1 : 0,
    nightTarget: initialDarkMode ? 1 : 0,
    frameId: null
  };

  function normalizedTerms(post) {
    return [...(post.categories || []), ...(post.tags || [])]
      .map((term) => String(term).normalize("NFKC").trim().toLowerCase());
  }

  function hasTerm(terms, words) {
    return terms.some((term) => words.some((word) => term.includes(word)));
  }

  function hasExactTerm(terms, words) {
    return words.some((word) => terms.includes(word));
  }

  function regionFor(post) {
    const terms = normalizedTerms(post);
    if (hasTerm(terms, ["salesforce", "sfdx", "apex", "scratch org"])) return "salesforce";
    if (hasTerm(terms, ["python", "pytest"]) || hasExactTerm(terms, ["pip"])) return "python";
    if (hasTerm(terms, ["agent", "bedrock", "artificial intelligence"]) || hasExactTerm(terms, ["ai", "rag", "llm", "mcp"])) return "agents";
    if (hasTerm(terms, ["aws", "cloud", "lambda", "serverless", "docker", "synology", "devops"])) return "cloud";
    if (hasTerm(terms, ["architecture", "design pattern", "security", "git", "version control", "engineering", "principle"])) return "engineering";
    if (hasTerm(terms, ["programming", "typescript", "javascript", "node", "jest", "web development", "development tool"])) return "code";
    return "archive";
  }

  function hash(value) {
    let result = 2166136261;
    for (let i = 0; i < value.length; i += 1) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
    return () => ((result = Math.imul(result ^ (result >>> 13), 1274126177)) >>> 0) / 4294967295;
  }

  function normalizePath(value) {
    if (!value) return "";
    try {
      const path = new URL(value, location.origin).pathname;
      return path.length > 1 ? path.replace(/\/$/, "") : path;
    } catch (_) {
      return "";
    }
  }

  function edgeKey(first, second) {
    return [normalizePath(first), normalizePath(second)].sort().join("::");
  }

  function buildEdges(items) {
    const byPath = new Map(items.map((item) => [normalizePath(item.url), item]));
    const found = new Map();
    const add = (from, to, semantic) => {
      if (!from || !to || from === to) return;
      const key = edgeKey(from.url, to.url);
      const existing = found.get(key);
      if (existing) existing.semantic = existing.semantic || semantic;
      else found.set(key, { key, from, to, semantic });
    };

    items.forEach((article) => {
      (article.related || []).slice(0, 3).forEach((url) => add(article, byPath.get(normalizePath(url)), true));
    });

    regions.forEach((region) => {
      const local = items
        .filter((article) => article.regionId === region.id)
        .sort((a, b) => a.y - b.y || a.x - b.x);
      for (let index = 1; index < local.length; index += 1) add(local[index - 1], local[index], false);
    });

    return [...found.values()];
  }

  const occupiedByRegion = Object.fromEntries(regions.map((region) => [region.id, []]));
  const articles = posts.map((post, index) => {
    const regionId = regionFor(post);
    const region = regions.find((item) => item.id === regionId);
    const random = hash(post.url);
    let angle = random() * Math.PI * 2;
    let radius = .16 + Math.sqrt(random()) * .72;
    let x = region.x;
    let y = region.y;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      x = region.x + Math.cos(angle) * region.rx * radius;
      y = region.y + Math.sin(angle) * region.ry * radius;
      const clear = occupiedByRegion[regionId].every((point) => Math.hypot(point.x - x, point.y - y) > 48);
      if (clear) break;
      angle += 2.399963229728653;
      radius = Math.min(.9, radius + .018);
    }
    occupiedByRegion[regionId].push({ x, y });
    return {
      ...post,
      regionId,
      x,
      y,
      size: index < 8 ? 12 : 9
    };
  });

  const articleByPath = new Map(articles.map((article) => [normalizePath(article.url), article]));
  const edges = buildEdges(articles);
  const requestedPath = normalizePath(new URLSearchParams(location.search).get("article") || "");
  const requestedArticle = articleByPath.get(requestedPath) || null;
  const startingArticle = requestedArticle || articles[0] || null;
  if (startingArticle) {
    state.camera.x = startingArticle.x;
    state.camera.y = startingArticle.y;
  }

  let visitors = [];
  let ownVisitorId = null;

  function fromNormalized(x, y) {
    return {
      x: world.minX + x * (world.maxX - world.minX),
      y: world.minY + y * (world.maxY - world.minY)
    };
  }

  function ownNormalizedPosition() {
    const worldX = state.camera.x + state.pointer.x - state.width / 2;
    const worldY = state.camera.y + state.pointer.y - state.height / 2;
    return {
      x: Math.max(0, Math.min(1, (worldX - world.minX) / (world.maxX - world.minX))),
      y: Math.max(0, Math.min(1, (worldY - world.minY) / (world.maxY - world.minY)))
    };
  }

  function updatePresence(event) {
    const label = document.querySelector("#explore-presence-status span:last-child");
    ownVisitorId = event.visitorId;
    if (event.mode === "live") {
      const previous = new Map(visitors.filter((visitor) => visitor.live).map((visitor) => [visitor.id, visitor]));
      visitors = event.visitors.filter((visitor) => visitor.id !== ownVisitorId).map((visitor) => {
        const target = fromNormalized(visitor.x, visitor.y);
        const existing = previous.get(visitor.id);
        return {
          ...visitor,
          x: existing?.x ?? target.x,
          y: existing?.y ?? target.y,
          targetX: target.x,
          targetY: target.y,
          live: true
        };
      });
      if (label) label.textContent = event.visitors.length ? `${event.visitors.length} explorers online` : "Be the first explorer";
    } else if (event.mode === "connecting") {
      if (label) label.textContent = "Connecting to the atlas…";
    } else if (event.mode === "offline") {
      visitors = [];
      if (label) label.textContent = "Atlas is quiet right now";
    } else {
      visitors = [];
      if (label) label.textContent = "Solo exploration · live presence off";
    }
  }

  function resize() {
    state.width = innerWidth;
    state.height = innerHeight;
    const mobile = matchMedia("(max-width: 720px)").matches;
    const pixelBudget = mobile ? 1280 * 720 : 2560 * 1440;
    const requestedDpr = Math.min(devicePixelRatio || 1, mobile ? 1.35 : 2);
    const budgetDpr = Math.sqrt(pixelBudget / Math.max(1, state.width * state.height));
    state.dpr = Math.max(1, Math.min(requestedDpr, budgetDpr));
    Object.entries(layerCanvases).forEach(([name, item]) => {
      item.width = Math.round(state.width * state.dpr);
      item.height = Math.round(state.height * state.dpr);
      layerContexts[name].setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    });
  }

  function screen(worldX, worldY) {
    return { x: worldX - state.camera.x + state.width / 2, y: worldY - state.camera.y + state.height / 2 };
  }

  function atlasUrl(path) {
    const url = new URL(path, atlasAssetRoot);
    if (atlasManifest?.revision) url.searchParams.set("v", atlasManifest.revision);
    return url.href;
  }

  function ensureAtlasImage(path) {
    if (!path) return null;
    const existing = atlasImages.get(path);
    if (existing) return existing;
    const entry = { status: "loading", image: new Image() };
    entry.image.decoding = "async";
    entry.image.onload = () => {
      entry.status = "ready";
      scheduleFrame();
    };
    entry.image.onerror = () => {
      entry.status = "error";
      scheduleFrame();
    };
    entry.image.src = atlasUrl(path);
    atlasImages.set(path, entry);
    return entry;
  }

  function rectIsVisible(x, y, width, height, padding = 80) {
    const p = screen(x, y);
    return p.x + width >= -padding
      && p.x <= state.width + padding
      && p.y + height >= -padding
      && p.y <= state.height + padding;
  }

  function drawAtlasTiles(layer) {
    if (!atlasManifest) return;
    const size = atlasManifest.tileSize;
    const originX = atlasManifest.world.originX;
    const originY = atlasManifest.world.originY;
    const groups = new Map();
    (atlasManifest.tiles[layer] || []).forEach((tile) => {
      const regionId = tile.region || "";
      if (!groups.has(regionId)) groups.set(regionId, []);
      groups.get(regionId).push(tile);
    });
    groups.forEach((tiles, regionId) => {
      ctx.save();
      const region = atlasManifest.regions?.find((item) => item.id === regionId);
      if (region) {
        const center = screen(region.x, region.y);
        ctx.translate(center.x, center.y);
        traceRegionShape(region);
        ctx.clip();
        ctx.translate(-center.x, -center.y);
      }
      tiles.forEach((tile) => {
        const x = originX + tile.x * size;
        const y = originY + tile.y * size;
        if (!rectIsVisible(x, y, size, size, size)) return;
        const p = screen(x, y);
        const image = ensureAtlasImage(tile.src);
        if (image?.status === "ready") {
          // A one-pixel overlap prevents subpixel seams while the camera moves.
          const drawX = Math.floor(p.x) - 1;
          const drawY = Math.floor(p.y) - 1;
          const sway = tile.motion === "foliage" && !reducedMotion
            ? Math.sin(state.time * .0007 + x * .01) * .006
            : 0;
          if (sway) {
            ctx.save();
            ctx.translate(drawX + size / 2, drawY + size / 2);
            ctx.rotate(sway);
            ctx.drawImage(image.image, -size / 2, -size / 2, size + 2, size + 2);
            ctx.restore();
          } else {
            ctx.drawImage(image.image, drawX, drawY, size + 2, size + 2);
          }
        } else if (layer === "base") {
          ctx.fillStyle = region?.fill || "#c9dfc4";
          ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, size + 2, size + 2);
        }
      });
      ctx.restore();
    });
  }

  function drawAtlasChunks() {
    if (!atlasManifest?.chunks) return;
    atlasManifest.chunks.filter((chunk) => chunk.active !== false).forEach((chunk) => {
      if (!rectIsVisible(chunk.x, chunk.y, chunk.width, chunk.height, 2048)) return;
      (chunk.tiles || []).forEach((tile) => {
        const x = chunk.x + tile.x * 512;
        const y = chunk.y + tile.y * 512;
        if (!rectIsVisible(x, y, 512, 512, 512)) return;
        const asset = ensureAtlasImage(tile.src);
        if (asset?.status !== "ready") return;
        const p = screen(x, y);
        const angle = (tile.rotation || 0) * Math.PI / 180;
        ctx.save();
        ctx.translate(Math.floor(p.x) + 256, Math.floor(p.y) + 256);
        ctx.rotate(angle);
        ctx.drawImage(asset.image, -257, -257, 514, 514);
        ctx.restore();
      });
    });
  }

  function regionUsesAtlasAssets(regionId) {
    if (!atlasManifest) return false;
    return (atlasManifest.tiles?.base || []).some((tile) => tile.region === regionId)
      || (atlasManifest.objects || []).some((item) => item.region === regionId);
  }

  function atlasObjectIsVisible(item) {
    const approximateHeight = item.width;
    return rectIsVisible(
      item.x - item.width / 2,
      item.y - approximateHeight,
      item.width,
      approximateHeight * 1.5
    );
  }

  function drawAtlasObject(item) {
    if (!atlasObjectIsVisible(item)) return;
    const image = atlasImages.get(item.src);
    const asset = image || ensureAtlasImage(item.src);
    if (asset?.status !== "ready") return;
    const naturalRatio = asset.image.naturalHeight / asset.image.naturalWidth;
    const width = item.width;
    const height = width * naturalRatio;
    const p = screen(item.x, item.y);
    const sway = item.motion === "foliage" && !reducedMotion
      ? Math.sin(state.time * .0007 + item.x * .01) * 2.5
      : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (sway) ctx.rotate(sway * Math.PI / 180);
    ctx.drawImage(
      asset.image,
      -width * (item.anchorX ?? .5),
      -height * (item.anchorY ?? .5),
      width,
      height
    );
    ctx.restore();
  }

  function drawAtlasObjects(layer) {
    if (!atlasManifest) return;
    atlasManifest.objects
      .filter((item) => item.layer === layer)
      .forEach(drawAtlasObject);
  }

  function updateNightFilter() {
    const night = atlasManifest?.night;
    const amount = state.nightAmount;
    if (!night || amount <= .001) {
      nightFilter.style.opacity = "0";
      return;
    }
    const tint = night.tint || {};
    nightFilter.style.background = tint.color || "#182744";
    nightFilter.style.mixBlendMode = tint.blend || "multiply";
    nightFilter.style.opacity = String((tint.opacity ?? .62) * amount);
  }

  function drawNightLights() {
    const night = atlasManifest?.night;
    const amount = state.nightAmount;
    if (!night || amount <= .001) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    (night.lights || []).forEach((light, index) => {
      if (!rectIsVisible(light.x - light.width / 2, light.y - light.width / 2, light.width, light.width)) return;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(state.motionTime * .0016 + index * 1.7) * (light.pulse || 0);
      drawAmbientSprite(light, light.src, light.x, light.y, light.width, (light.opacity ?? 1) * amount * pulse);
    });
    ctx.restore();
  }

  function signSpriteFor(regionId) {
    return atlasManifest?.objects.find((item) => item.region === regionId && item.id.endsWith("-sign"))?.src;
  }

  function drawNavigationLandmarks() {
    (atlasManifest?.signposts || []).forEach((signpost) => {
      if (!rectIsVisible(signpost.x - 50, signpost.y - 85, 100, 100)) return;
      drawAmbientSprite(signpost, signSpriteFor(signpost.region), signpost.x, signpost.y, 92, .96);
    });
    (atlasManifest?.portals || []).forEach((portal) => {
      if (!rectIsVisible(portal.x - portal.width / 2, portal.y - portal.width, portal.width, portal.width)) return;
      drawAmbientSprite(portal, portal.src, portal.x, portal.y, portal.width, 1);
    });
  }

  function cubicPoint(track, t) {
    const u = 1 - t;
    const blend = (key, axis) => u ** 3 * track.from[axis]
      + 3 * u ** 2 * t * track.control1[axis]
      + 3 * u * t ** 2 * track.control2[axis]
      + t ** 3 * track.to[axis];
    return { x: blend("x", 0), y: blend("y", 1) };
  }

  function drawAmbientSprite(item, sprite, x, y, width, alpha, rotation = 0, flip = false) {
    const asset = ensureAtlasImage(sprite);
    if (asset?.status !== "ready") return;
    const p = screen(x, y);
    const height = width * asset.image.naturalHeight / asset.image.naturalWidth;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(asset.image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function drawAmbientLayer(layer) {
    if (!atlasManifest?.ambient) return;
    const seconds = state.motionTime / 1000;
    atlasManifest.ambient.filter((item) => item.layer === layer).forEach((item) => {
      const region = atlasManifest.regions.find((candidate) => candidate.id === item.region);
      if (!region || !regionIsVisible(region, 180)) return;
      const count = reducedMotion ? 1 : item.count;
      ctx.save();
      const center = screen(region.x, region.y);
      ctx.translate(center.x, center.y);
      traceRegionShape(region);
      ctx.clip();
      ctx.translate(-center.x, -center.y);
      for (let index = 0; index < count; index += 1) {
        const random = hash(`${item.seed}:${index}`);
        const sprite = item.sprites[index % item.sprites.length];
        const size = item.size[0] + random() * (item.size[1] - item.size[0]);
        const opacity = item.opacity[0] + random() * (item.opacity[1] - item.opacity[0]);
        const speed = item.speed[0] + random() * (item.speed[1] - item.speed[0]);
        if (reducedMotion) {
          drawAmbientSprite(item, sprite, region.x, region.y, size, opacity);
        } else if (item.behavior === "drift") {
          const start = random();
          const progress = (start + seconds * speed / item.bounds.width) % 1;
          const x = item.bounds.x + progress * item.bounds.width;
          const y = item.bounds.y + random() * item.bounds.height + Math.sin(seconds * .7 + index) * 10;
          const fade = item.edgeFade ? Math.sin(Math.PI * progress) : 1;
          drawAmbientSprite(item, sprite, x, y, size, opacity * fade, progress * .35);
        } else if (item.behavior === "ripple") {
          const anchor = item.anchors[index % item.anchors.length];
          const progress = (seconds * speed + random()) % 1;
          drawAmbientSprite(item, sprite, anchor[0], anchor[1], size * (.65 + .6 * progress), opacity * (1 - progress));
        } else if (item.behavior === "pulse") {
          const x = item.bounds.x + random() * item.bounds.width + Math.sin(seconds * speed * 3 + index) * 8;
          const y = item.bounds.y + random() * item.bounds.height + Math.cos(seconds * speed * 2 + index) * 8;
          const pulse = (Math.sin(seconds * speed * Math.PI * 2 + random() * 6.28) + 1) / 2;
          drawAmbientSprite(item, sprite, x, y, size, item.opacity[0] + pulse * (item.opacity[1] - item.opacity[0]));
        } else {
          const track = item.tracks[index % item.tracks.length];
          const distance = Math.hypot(track.to[0] - track.from[0], track.to[1] - track.from[1]);
          const raw = (seconds * speed / Math.max(1, distance) + random()) % 1;
          const reverse = Math.floor((seconds * speed / Math.max(1, distance) + random()) % 2) === 1;
          const progress = reverse ? 1 - raw : raw;
          const point = cubicPoint(track, progress);
          const fade = item.behavior === "haunt" ? Math.sin(Math.PI * raw) : 1;
          drawAmbientSprite(item, sprite, point.x, point.y, size, opacity * fade, 0, reverse);
        }
      }
      ctx.restore();
    });
  }

  function drawDepthSortedWorld() {
    const queue = [];
    (atlasManifest?.objects || [])
      .filter((item) => item.layer === "world" && atlasObjectIsVisible(item))
      .forEach((item) => queue.push({
        depth: item.y,
        priority: 0,
        draw: () => drawAtlasObject(item)
      }));
    articles.forEach((article) => queue.push({
      depth: article.y,
      priority: 1,
      draw: () => drawArticle(article)
    }));
    visitors.forEach((visitor, index) => {
      const verticalDrift = visitor.live || reducedMotion
        ? 0
        : Math.cos(state.time * .00038 + (visitor.phase || 0)) * 20;
      queue.push({
        depth: visitor.y + verticalDrift,
        priority: 2,
        draw: () => drawVisitor(visitor, index)
      });
    });
    queue
      .sort((a, b) => a.depth - b.depth || a.priority - b.priority)
      .forEach((entry) => entry.draw());
  }

  function startRiveOcean() {
    if (!atlasManifest || riveOceanStatus !== "idle" || reducedMotion) return;
    const animation = atlasManifest.animations?.ocean;
    if (!animation?.enabled || !window.rive?.Rive) {
      riveOceanStatus = "error";
      return;
    }
    riveOceanStatus = "loading";
    try {
      window.rive.RuntimeLoader?.setWasmUrl(stage.dataset.riveWasm);
      riveOceanCanvas = document.createElement("canvas");
      riveOceanCanvas.width = 1100;
      riveOceanCanvas.height = 410;
      riveOcean = new window.rive.Rive({
        src: atlasUrl(animation.src),
        canvas: riveOceanCanvas,
        artboard: animation.artboard,
        stateMachines: animation.stateMachine,
        autoplay: true,
        enableRiveAssetCDN: false,
        onLoad: () => {
          riveOceanStatus = "ready";
          riveOcean.resizeDrawingSurfaceToCanvas?.();
          scheduleFrame();
        },
        onLoadError: () => {
          riveOceanStatus = "error";
          riveOcean?.cleanup?.();
          riveOcean = null;
          scheduleFrame();
        }
      });
    } catch (_) {
      riveOceanStatus = "error";
      riveOcean = null;
    }
  }

  function traceWaterShape(p, animation) {
    const { width, height } = animation;
    ctx.beginPath();
    ctx.moveTo(p.x - 45, p.y + height * .18);
    ctx.bezierCurveTo(
      p.x + width * .18, p.y - height * .1,
      p.x + width * .38, p.y + height * .14,
      p.x + width * .58, p.y + height * .02
    );
    ctx.bezierCurveTo(
      p.x + width * .76, p.y - height * .08,
      p.x + width * .9, p.y + height * .16,
      p.x + width + 45, p.y + height * .08
    );
    ctx.bezierCurveTo(
      p.x + width * .98, p.y + height * .74,
      p.x + width * .76, p.y + height * 1.08,
      p.x + width * .54, p.y + height * .92
    );
    ctx.bezierCurveTo(
      p.x + width * .3, p.y + height * .78,
      p.x + width * .12, p.y + height * 1.08,
      p.x - 45, p.y + height * .82
    );
    ctx.bezierCurveTo(
      p.x - 105, p.y + height * .65,
      p.x - 95, p.y + height * .34,
      p.x - 45, p.y + height * .18
    );
    ctx.closePath();
  }

  function drawAtlasWater() {
    const animation = atlasManifest?.animations?.ocean;
    if (!animation) return;
    if (!rectIsVisible(animation.x, animation.y, animation.width, animation.height, 120)) return;
    const p = screen(animation.x, animation.y);
    if (riveOceanStatus === "idle") startRiveOcean();
    if (riveOceanStatus === "ready" && riveOceanCanvas) {
      ctx.drawImage(riveOceanCanvas, p.x, p.y, animation.width, animation.height);
      return;
    }
    const fallback = ensureAtlasImage(animation.fallback);
    if (fallback?.status === "ready") {
      ctx.save();
      traceWaterShape(p, animation);
      ctx.clip();
      ctx.drawImage(fallback.image, p.x - 45, p.y - 30, animation.width + 90, animation.height + 75);
      ctx.restore();
    }
  }

  async function loadAtlasManifest() {
    try {
      const response = await fetch(stage.dataset.atlasManifest, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Atlas manifest ${response.status}`);
      const candidate = await response.json();
      if (candidate.version !== 1 || candidate.tileSize !== 512) throw new Error("Unsupported atlas manifest");
      atlasManifest = candidate;
      const activeChunks = candidate.chunks?.filter((chunk) => chunk.active !== false) || [];
      if (activeChunks.length) {
        world.minX = Math.min(...activeChunks.map((chunk) => chunk.x));
        world.maxX = Math.max(...activeChunks.map((chunk) => chunk.x + chunk.width));
        world.minY = Math.min(...activeChunks.map((chunk) => chunk.y));
        world.maxY = Math.max(...activeChunks.map((chunk) => chunk.y + chunk.height));
      }
      scheduleFrame();
    } catch (_) {
      atlasManifest = null;
      scheduleFrame();
    }
  }

  function regionIsVisible(region, padding = 100) {
    const p = screen(region.x, region.y);
    return p.x + region.rx >= -padding
      && p.x - region.rx <= state.width + padding
      && p.y + region.ry >= -padding
      && p.y - region.ry <= state.height + padding;
  }

  function traceRegionShape(region) {
    ctx.beginPath();
    const steps = 96;
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const wobble = 1 + Math.sin(angle * 5 + region.x) * .035 + Math.cos(angle * 3) * .025;
      const x = Math.cos(angle) * region.rx * wobble;
      const y = Math.sin(angle) * region.ry * wobble;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function blob(region) {
    const p = screen(region.x, region.y);
    const colors = palette[region.id];
    ctx.save();
    ctx.translate(p.x, p.y);
    traceRegionShape(region);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.restore();
  }

  function drawRegionFrame(region) {
    const p = screen(region.x, region.y);
    const colors = palette[region.id];
    ctx.save();
    ctx.translate(p.x, p.y);
    traceRegionShape(region);
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(33,53,45,.66)";
    ctx.font = "800 13px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(colors.name.toUpperCase(), 0, -region.ry + 48);
    ctx.restore();
  }

  function landscape(region) {
    const random = hash(`landscape-${region.id}`);
    const colors = palette[region.id];
    for (let i = 0; i < 28; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = .18 + random() * .72;
      const p = screen(region.x + Math.cos(angle) * region.rx * radius, region.y + Math.sin(angle) * region.ry * radius);
      ctx.fillStyle = i % 3 ? colors.edge : "rgba(255,255,255,.5)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawArticle(article) {
    const p = screen(article.x, article.y);
    if (p.x < -60 || p.y < -60 || p.x > state.width + 60 || p.y > state.height + 60) return;
    const colors = palette[article.regionId];
    const pulse = reducedMotion ? 0 : Math.sin(state.time * .003 + article.x) * 2;
    if (state.waypoint?.target === article) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, article.size + 19 + pulse * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 113, 73, .72)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, article.size + 8 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = `${colors.beacon}35`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, article.size, 0, Math.PI * 2);
    ctx.fillStyle = colors.beacon;
    ctx.fill();
    ctx.strokeStyle = "#263b32";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + article.size);
    ctx.lineTo(p.x - 5, p.y + article.size + 13);
    ctx.lineTo(p.x + 6, p.y + article.size + 9);
    ctx.closePath();
    ctx.fillStyle = "#f5f0df";
    ctx.fill();
    ctx.stroke();
  }

  function drawSelectedArticleIndicator() {
    const article = state.nearest;
    if (!article) return;
    const p = screen(article.x, article.y);
    if (p.x < -60 || p.y < -60 || p.x > state.width + 60 || p.y > state.height + 60) return;
    const radius = article.size + 14;

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff9e9";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = "#20362c";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y - radius - 5);
    ctx.lineTo(p.x - 8, p.y - radius - 17);
    ctx.lineTo(p.x + 8, p.y - radius - 17);
    ctx.closePath();
    ctx.fillStyle = "#fff9e9";
    ctx.fill();
    ctx.strokeStyle = "#20362c";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  function drawVisitor(visitor, index) {
    const phase = visitor.phase || 0;
    const drift = visitor.live || reducedMotion ? 0 : Math.sin(state.time * .00045 + phase) * 32;
    const verticalDrift = visitor.live || reducedMotion ? 0 : Math.cos(state.time * .00038 + phase) * 20;
    const p = screen(visitor.x + drift, visitor.y + verticalDrift);
    if (p.x < -50 || p.y < -50 || p.x > state.width + 50 || p.y > state.height + 50) return;
    ctx.save();
    ctx.globalAlpha = visitor.status === "paused" ? .42 : 1;
    ctx.translate(p.x, p.y);
    ctx.rotate(-.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 20);
    ctx.lineTo(6, 15);
    ctx.lineTo(10, 25);
    ctx.lineTo(15, 22);
    ctx.lineTo(10, 12);
    ctx.lineTo(18, 11);
    ctx.closePath();
    ctx.fillStyle = ["#f16f54", "#5a86a8", "#8b6fa8", "#dfaa3f"][index % 4];
    ctx.strokeStyle = "#263b32";
    ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = visitor.status === "paused" ? .42 : 1;
    ctx.fillStyle = "rgba(245,240,223,.9)";
    ctx.fillRect(p.x + 13, p.y - 12, 25, 15);
    ctx.fillStyle = "#263b32";
    ctx.font = "800 9px system-ui";
    ctx.fillText(visitor.country, p.x + 18, p.y - 1);
    ctx.globalAlpha = 1;
  }

  function drawOwnCursor() {
    if (!state.pointer.active || state.pointer.type === "touch" || !state.entered || state.paused) return;
    const { x, y } = state.pointer;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.45);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 25); ctx.lineTo(7, 18); ctx.lineTo(12, 30); ctx.lineTo(18, 27); ctx.lineTo(13, 15); ctx.lineTo(23, 14); ctx.closePath();
    ctx.fillStyle = "#fff6cf"; ctx.strokeStyle = "#20362c"; ctx.lineWidth = 2.5; ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#20362c"; ctx.font = "800 10px system-ui"; ctx.fillText("YOU", x + 19, y - 5);
  }

  function relatedArticles(article) {
    const semantic = (article?.related || [])
      .map((url) => articleByPath.get(normalizePath(url)))
      .filter(Boolean);
    const trailNeighbors = edges
      .filter((edge) => edge.from === article || edge.to === article)
      .map((edge) => edge.from === article ? edge.to : edge.from);
    return [...semantic, ...trailNeighbors]
      .filter((item, index, list) => item && list.indexOf(item) === index && item !== article)
      .slice(0, 3);
  }

  function selectArticle(article) {
    if (article === state.nearest) return;
    state.nearest = article;
    const card = document.getElementById("explore-card");
    if (!article) { card.hidden = true; return; }
    const related = relatedArticles(article);
    document.getElementById("explore-card-region").textContent = palette[article.regionId].name;
    const maintenanceBadge = document.getElementById("explore-card-maintenance");
    maintenanceBadge.hidden = article.maintenance_status !== "replacement";
    maintenanceBadge.textContent = article.language === "ko" ? "개정 가이드" : "Updated guide";
    document.getElementById("explore-card-title").textContent = article.title;
    document.getElementById("explore-card-description").textContent = article.description;
    document.getElementById("explore-card-date").textContent = article.date;
    document.getElementById("explore-card-link").href = article.url;
    const trails = document.getElementById("explore-card-trails");
    const relatedList = document.getElementById("explore-card-related");
    relatedList.replaceChildren(...related.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.articleUrl = item.url;
      button.textContent = item.title;
      button.title = `Set ${item.title} as a destination`;
      return button;
    }));
    trails.hidden = related.length === 0;
    card.hidden = false;
  }

  function lockTarget(kind, target, options = {}) {
    if (!target) return;
    state.lockedTarget = { kind, target };
    state.pointerGesture = null;
    if (kind === "article") {
      showLandmarkMenu(null, { preserveLock: true });
      selectArticle(target);
      document.getElementById("explore-card").dataset.locked = "true";
      if (options.focus !== false) document.getElementById("explore-card-link").focus({ preventScroll: true });
    } else {
      selectArticle(null);
      showLandmarkHint(null);
      showLandmarkMenu(target, { preserveLock: true });
      signpostMenu.dataset.locked = "true";
      if (options.focus === true) {
        (signpostDestinations.querySelector("button") || document.getElementById("explore-signpost-close"))
          .focus({ preventScroll: true });
      }
    }
  }

  function unlockTarget({ focusCanvas = true } = {}) {
    if (!state.lockedTarget) return false;
    const kind = state.lockedTarget.kind;
    state.lockedTarget = null;
    if (kind === "article") {
      document.getElementById("explore-card").removeAttribute("data-locked");
      selectArticle(null);
    } else {
      signpostMenu.removeAttribute("data-locked");
      showLandmarkMenu(null, { preserveLock: true });
    }
    if (kind === "article") state.pointer.active = false;
    if (focusCanvas) canvas.focus({ preventScroll: true });
    return true;
  }

  function focusArticle(article) {
    if (!article) return;
    state.camera.x = article.x;
    state.camera.y = article.y;
    state.pointer.x = state.width / 2;
    state.pointer.y = state.height / 2;
    state.pointer.active = true;
    selectArticle(article);
  }

  const waypointPanel = document.getElementById("explore-waypoint");
  const waypointArrow = document.getElementById("explore-waypoint-arrow");

  function travelerPosition() {
    return {
      x: state.camera.x + state.pointer.x - state.width / 2,
      y: state.camera.y + state.pointer.y - state.height / 2
    };
  }

  function clearWaypoint() {
    state.waypoint = null;
    waypointPanel.hidden = true;
  }

  function setWaypoint(article) {
    if (!article) return;
    state.waypoint = { kind: "article", target: article, x: article.x, y: article.y, title: article.title, arrivalRadius: 82 };
    document.getElementById("explore-waypoint-title").textContent = article.title;
    waypointPanel.hidden = false;
    updateWaypoint();
  }

  function setRegionWaypoint(destinationId) {
    const portal = atlasManifest?.portals?.find((item) => item.id === destinationId);
    const region = atlasManifest?.regions?.find((item) => item.id === destinationId);
    const target = portal || region;
    if (!target) return;
    state.waypoint = {
      kind: portal ? "portal" : "region",
      target,
      x: target.x,
      y: target.y,
      title: portal?.name || target.name,
      arrivalRadius: target.arrivalRadius || 180
    };
    document.getElementById("explore-waypoint-title").textContent = state.waypoint.title;
    waypointPanel.hidden = false;
    updateWaypoint();
  }

  function updateWaypoint() {
    if (!state.waypoint || !state.pointer.active) return;
    const traveler = travelerPosition();
    const dx = state.waypoint.x - traveler.x;
    const dy = state.waypoint.y - traveler.y;
    const distance = Math.hypot(dx, dy);
    const rounded = Math.max(50, Math.round(distance / 50) * 50);
    waypointArrow.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI + 90}deg)`;
    document.getElementById("explore-waypoint-distance").textContent = distance < 110 ? "Almost there" : `About ${rounded}m away`;
    if (distance < state.waypoint.arrivalRadius) {
      const destination = state.waypoint;
      clearWaypoint();
      if (destination.kind === "article") lockTarget("article", destination.target, { focus: false });
    }
  }

  const signpostMenu = document.getElementById("explore-signpost-menu");
  const signpostHint = document.getElementById("explore-signpost-hint");
  const signpostTitle = document.getElementById("explore-signpost-title");
  const signpostDestinations = document.getElementById("explore-signpost-destinations");

  function destinationLabel(id) {
    return atlasManifest?.regions?.find((item) => item.id === id)?.name
      || atlasManifest?.portals?.find((item) => item.id === id)?.name
      || id;
  }

  function showLandmarkMenu(landmark, options = {}) {
    if (state.lockedTarget && !options.preserveLock) return;
    if (!landmark) {
      signpostMenu.hidden = true;
      signpostMenu.removeAttribute("data-side");
      signpostDestinations.replaceChildren();
      return;
    }
    if (landmark.status === "locked") {
      signpostTitle.textContent = landmark.message;
      const note = document.createElement("span");
      note.textContent = `${landmark.name} · Coming soon`;
      signpostDestinations.replaceChildren(note);
    } else {
      signpostTitle.textContent = "Choose a destination";
      signpostDestinations.replaceChildren(...landmark.destinations.map((id) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.regionDestination = id;
        button.textContent = `${destinationLabel(id)} →`;
        return button;
      }));
    }
    signpostMenu.hidden = false;
    positionLandmarkOverlays();
  }

  function showLandmarkHint(landmark) {
    state.nearbyLandmark = landmark;
    if (!landmark || state.lockedTarget) {
      signpostHint.hidden = true;
      return;
    }
    signpostHint.textContent = landmark.status === "locked"
      ? "Click to see what’s coming next"
      : "Click the sign to find another region";
    signpostHint.hidden = false;
    positionLandmarkOverlays();
  }

  function positionLandmarkOverlays() {
    const hintTarget = !signpostHint.hidden ? state.nearbyLandmark : null;
    if (hintTarget) {
      const anchor = screen(hintTarget.x, hintTarget.y);
      const width = signpostHint.offsetWidth;
      const height = signpostHint.offsetHeight;
      signpostHint.style.left = `${Math.max(12, Math.min(state.width - width - 12, anchor.x - width / 2))}px`;
      signpostHint.style.top = `${Math.max(12, anchor.y - height - 30)}px`;
    }
    const menuTarget = state.lockedTarget?.kind === "signpost" || state.lockedTarget?.kind === "portal"
      ? state.lockedTarget.target : null;
    if (!menuTarget || signpostMenu.hidden) return;
    if (matchMedia("(max-width: 640px)").matches) {
      signpostMenu.removeAttribute("data-side");
      signpostMenu.style.left = "0px";
      signpostMenu.style.top = "auto";
      signpostMenu.style.bottom = "0px";
      return;
    }
    const anchor = screen(menuTarget.x, menuTarget.y);
    const width = signpostMenu.offsetWidth;
    const height = signpostMenu.offsetHeight;
    const fitsRight = anchor.x + 32 + width <= state.width - 12;
    signpostMenu.dataset.side = fitsRight ? "right" : "left";
    signpostMenu.style.left = `${Math.max(12, Math.min(state.width - width - 12,
      fitsRight ? anchor.x + 32 : anchor.x - width - 32))}px`;
    signpostMenu.style.top = `${Math.max(12, Math.min(state.height - height - 12, anchor.y - 34))}px`;
    signpostMenu.style.bottom = "auto";
  }

  function updateNearbyLandmark() {
    if (state.lockedTarget) return showLandmarkHint(null);
    if (!state.entered || !state.pointer.active || !state.pointer.mapActive || !atlasManifest) return showLandmarkHint(null);
    const traveler = travelerPosition();
    const candidates = [...(atlasManifest.signposts || []), ...(atlasManifest.portals || [])];
    const nearby = candidates
      .map((item) => ({ item, distance: Math.hypot(item.x - traveler.x, item.y - traveler.y) }))
      .filter(({ item, distance }) => distance <= (item.status === "locked"
        ? item.interactionRadius
        : Math.min(item.interactionRadius, SIGNPOST_INTERACTION_RADIUS)))
      .sort((a, b) => a.distance - b.distance)[0]?.item || null;
    if (nearby) selectArticle(null);
    showLandmarkHint(nearby);
  }

  function saveNavigation(article) {
    if (!article) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        article: normalizePath(article.url),
        camera: { x: state.camera.x, y: state.camera.y }
      }));
    } catch (_) {
      // Browsing still works when storage is disabled.
    }
  }

  function restoreNavigation(article) {
    if (!article) return false;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (saved?.article !== normalizePath(article.url)) return false;
      const x = Number(saved.camera?.x);
      const y = Number(saved.camera?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      state.camera.x = Math.max(world.minX, Math.min(world.maxX, x));
      state.camera.y = Math.max(world.minY, Math.min(world.maxY, y));
      return true;
    } catch (_) {
      return false;
    }
  }

  function navigateToArticle(article) {
    if (!article) return;
    saveNavigation(article);
    window.location.href = article.url;
  }

  function updateNearest() {
    if (state.lockedTarget) return;
    if (state.nearbyLandmark) return selectArticle(null);
    if (!state.entered || !state.pointer.active || state.paused || state.wheelOpen || state.pitOpen) return;
    const worldX = state.camera.x + state.pointer.x - state.width / 2;
    const worldY = state.camera.y + state.pointer.y - state.height / 2;
    let nearest = null;
    let best = 82;
    articles.forEach((article) => {
      const distance = Math.hypot(article.x - worldX, article.y - worldY);
      if (distance < best) { best = distance; nearest = article; }
    });
    selectArticle(nearest);
  }

  function renderWorld() {
    const visibleRegions = regions.filter((region) => regionIsVisible(region));

    ctx = layerContexts.backdrop;
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#c9dfc4";
    ctx.fillRect(0, 0, state.width, state.height);
    drawAmbientLayer("backdrop");
    drawAtlasWater();

    ctx = layerContexts.base;
    ctx.clearRect(0, 0, state.width, state.height);
    drawAtlasChunks();
    drawAtlasTiles("base");
    drawAtlasObjects("base");
    if (atlasManifest?.animations?.ocean) {
      const water = atlasManifest.animations.ocean;
      const p = screen(water.x, water.y);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      traceWaterShape(p, water);
      ctx.fill();
      ctx.restore();
    }
    const legacyRegions = visibleRegions.filter((region) => !regionUsesAtlasAssets(region.id));
    legacyRegions.forEach(blob);
    legacyRegions.forEach(landscape);

    ctx = layerContexts.world;
    ctx.clearRect(0, 0, state.width, state.height);
    legacyRegions.forEach(drawRegionFrame);
    drawAmbientLayer("world");
    drawAtlasObjects("makers-road");
    drawNavigationLandmarks();
    drawDepthSortedWorld();
    drawSelectedArticleIndicator();

    ctx = layerContexts.top;
    ctx.clearRect(0, 0, state.width, state.height);
    drawAtlasTiles("top");
    drawAtlasObjects("top");
    drawAmbientLayer("top");
    updateNightFilter();

    ctx = layerContexts.night;
    ctx.clearRect(0, 0, state.width, state.height);
    drawNightLights();

    renderCursorLayer();
    positionLandmarkOverlays();
  }

  function renderCursorLayer() {
    ctx = layerContexts.cursor;
    ctx.clearRect(0, 0, state.width, state.height);
    drawOwnCursor();
  }

  function scheduleFrame() {
    if (state.frameId !== null || document.hidden || state.paused || state.pitOpen) return;
    state.frameId = requestAnimationFrame(tick);
  }

  function stopAnimation() {
    if (state.frameId !== null) cancelAnimationFrame(state.frameId);
    state.frameId = null;
    state.lastTick = null;
  }

  function tick(time) {
    state.frameId = null;
    state.time = time;
    const elapsed = state.lastTick === null ? 0 : Math.min(.1, (time - state.lastTick) / 1000);
    state.lastTick = time;
    state.motionTime += elapsed * 1000;
    if (state.nightAmount !== state.nightTarget) {
      if (reducedMotion) state.nightAmount = state.nightTarget;
      else {
        const direction = Math.sign(state.nightTarget - state.nightAmount);
        state.nightAmount += direction * elapsed / .3;
        if ((direction > 0 && state.nightAmount >= state.nightTarget)
          || (direction < 0 && state.nightAmount <= state.nightTarget)) {
          state.nightAmount = state.nightTarget;
        }
      }
    }
    if (state.entered && state.pointer.active && state.pointer.mapActive && !state.paused && !state.wheelOpen && !state.pitOpen
      && !state.lockedTarget && !state.nearbyLandmark && state.pointerGesture?.pointerType !== "touch") {
      state.activeSeconds += elapsed;
      const nx = state.pointer.x / state.width * 2 - 1;
      const ny = state.pointer.y / state.height * 2 - 1;
      const edgeX = Math.abs(nx) > .62 ? Math.sign(nx) * ((Math.abs(nx) - .62) / .38) : 0;
      const edgeY = Math.abs(ny) > .56 ? Math.sign(ny) * ((Math.abs(ny) - .56) / .44) : 0;
      state.camera.x += edgeX * 7;
      state.camera.y += edgeY * 7;
      state.camera.x = Math.max(world.minX, Math.min(world.maxX, state.camera.x));
      state.camera.y = Math.max(world.minY, Math.min(world.maxY, state.camera.y));
      const currentRegion = regions.find((region) => {
        const dx = (state.camera.x - region.x) / region.rx;
        const dy = (state.camera.y - region.y) / region.ry;
        return dx * dx + dy * dy <= 1;
      });
      if (currentRegion) state.visitedRegions.add(currentRegion.id);
    }
    visitors.forEach((visitor) => {
      if (!visitor.live) return;
      visitor.x += (visitor.targetX - visitor.x) * .12;
      visitor.y += (visitor.targetY - visitor.y) * .12;
    });
    if (state.entered && state.pointer.active && !state.paused && !state.pitOpen && window.ArticleAtlasPresence) {
      const position = ownNormalizedPosition();
      window.ArticleAtlasPresence.move(position.x, position.y);
    }
    renderWorld();
    updateNearbyLandmark();
    updateNearest();
    updateWaypoint();
    maybeOpenPit();
    scheduleFrame();
  }

  shell.addEventListener("pointermove", (event) => {
    if (!state.entered || state.paused) return;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.type = event.pointerType || "mouse";
    state.pointer.active = true;
    state.pointer.mapActive = stage.contains(event.target);
    if (state.pitOpen) renderCursorLayer();
  });
  shell.addEventListener("pointerleave", () => {
    state.pointer.active = false;
    state.pointer.mapActive = false;
    if (state.pitOpen) renderCursorLayer();
  });
  stage.addEventListener("pointermove", (event) => {
    if (state.paused || state.lockedTarget) return;
    if (state.pointerGesture?.pointerId === event.pointerId) {
      state.pointerGesture.moved ||= Math.hypot(
        event.clientX - state.pointerGesture.startX,
        event.clientY - state.pointerGesture.startY
      ) >= 8;
      if (state.pointerGesture.pointerType === "touch" && state.pointerGesture.moved) {
        state.camera.x = Math.max(world.minX, Math.min(world.maxX,
          state.camera.x - (event.clientX - state.pointerGesture.lastX)));
        state.camera.y = Math.max(world.minY, Math.min(world.maxY,
          state.camera.y - (event.clientY - state.pointerGesture.lastY)));
      }
      state.pointerGesture.lastX = event.clientX;
      state.pointerGesture.lastY = event.clientY;
    }
    state.pointer.x = event.clientX; state.pointer.y = event.clientY; state.pointer.active = true; state.pointer.mapActive = true;
  });
  stage.addEventListener("pointerleave", () => { state.pointer.mapActive = false; });
  window.addEventListener("blur", () => { state.pointer.active = false; state.pointer.mapActive = false; });
  window.addEventListener("onColorSchemeChange", (event) => {
    state.nightTarget = event.detail === "dark" ? 1 : 0;
    document.body.classList.toggle("atlas-night-mode", state.nightTarget === 1);
    if (reducedMotion) state.nightAmount = state.nightTarget;
    scheduleFrame();
  });
  colorSchemeMedia.addEventListener("change", (event) => {
    if (document.documentElement.dataset.userColorScheme) return;
    state.nightTarget = event.matches ? 1 : 0;
    document.body.classList.toggle("atlas-night-mode", state.nightTarget === 1);
    if (reducedMotion) state.nightAmount = state.nightTarget;
    scheduleFrame();
  });
  stage.addEventListener("click", (event) => {
    if (state.wheelOpen) { closeWheel(); return; }
    if (state.suppressNextClick) { state.suppressNextClick = false; return; }
    if (state.lockedTarget) { unlockTarget(); return; }
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.active = true;
    updateNearbyLandmark();
    updateNearest();
    if (state.nearbyLandmark) lockTarget(
      state.nearbyLandmark.status === "locked" ? "portal" : "signpost",
      state.nearbyLandmark,
      { focus: false }
    );
    else if (state.nearest) lockTarget("article", state.nearest);
    else if (event.pointerType === "touch") state.pointer.active = false;
  });
  stage.addEventListener("pointerdown", (event) => {
    state.pointerGesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false
    };
    if (event.pointerType === "touch") stage.setPointerCapture?.(event.pointerId);
    if (state.lockedTarget) return;
    state.pointer.x = event.clientX; state.pointer.y = event.clientY; state.pointer.active = true;
  });
  stage.addEventListener("pointerup", (event) => {
    if (state.pointerGesture?.pointerId !== event.pointerId) return;
    state.suppressNextClick = state.pointerGesture.moved;
    if (state.pointerGesture.pointerType === "touch") state.pointer.active = false;
    state.pointerGesture = null;
  });
  stage.addEventListener("pointercancel", () => { state.pointerGesture = null; });
  canvas.addEventListener("keydown", (event) => {
    if (!state.entered || state.paused || state.pitOpen) return;
    if (state.lockedTarget) return;
    const movement = { ArrowUp: [0, -120], ArrowDown: [0, 120], ArrowLeft: [-120, 0], ArrowRight: [120, 0] }[event.key];
    if (movement) {
      event.preventDefault();
      state.camera.x = Math.max(world.minX, Math.min(world.maxX, state.camera.x + movement[0]));
      state.camera.y = Math.max(world.minY, Math.min(world.maxY, state.camera.y + movement[1]));
      state.pointer.x = state.width / 2;
      state.pointer.y = state.height / 2;
      state.pointer.active = true;
      updateNearest();
    } else if (event.key === "Enter" && state.nearbyLandmark && !signpostHint.hidden) {
      event.preventDefault();
      lockTarget(state.nearbyLandmark.status === "locked" ? "portal" : "signpost", state.nearbyLandmark, { focus: true });
    } else if (event.key === "Enter" && state.nearest) {
      event.preventDefault();
      lockTarget("article", state.nearest);
    } else if (event.key === "Escape" && state.waypoint) {
      event.preventDefault();
      clearWaypoint();
    }
  });

  document.getElementById("explore-enter").addEventListener("click", () => {
    state.entered = true;
    shell.classList.add("is-exploring");
    window.ArticleAtlasPresence?.connect();
    if (requestedArticle) {
      if (!restoreNavigation(requestedArticle)) focusArticle(requestedArticle);
      else {
        selectArticle(requestedArticle);
      }
      lockTarget("article", requestedArticle, { focus: false });
    }
    const intro = document.getElementById("explore-intro");
    intro.classList.add("is-leaving");
    setTimeout(() => {
      intro.hidden = true;
      if (state.lockedTarget?.kind === "article") {
        document.getElementById("explore-card-link").focus({ preventScroll: true });
      } else if (state.lockedTarget) {
        (signpostDestinations.querySelector("button") || document.getElementById("explore-signpost-close"))
          .focus({ preventScroll: true });
      } else {
        canvas.focus({ preventScroll: true });
      }
    }, reducedMotion ? 0 : 360);
  });
  document.getElementById("explore-card-link").addEventListener("click", () => saveNavigation(state.nearest));
  const articleCardClose = document.getElementById("explore-card-close");
  articleCardClose.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch") return;
    event.preventDefault();
    event.stopPropagation();
    unlockTarget();
  });
  articleCardClose.addEventListener("click", (event) => {
    event.stopPropagation();
    unlockTarget();
  });
  document.getElementById("explore-card-related").addEventListener("click", (event) => {
    const button = event.target.closest("[data-article-url]");
    if (!button) return;
    setWaypoint(articleByPath.get(normalizePath(button.dataset.articleUrl)));
    unlockTarget();
  });
  document.getElementById("explore-waypoint-cancel").addEventListener("click", clearWaypoint);
  signpostDestinations.addEventListener("click", (event) => {
    const button = event.target.closest("[data-region-destination]");
    if (!button) return;
    setRegionWaypoint(button.dataset.regionDestination);
    unlockTarget();
  });
  document.getElementById("explore-signpost-close").addEventListener("click", () => unlockTarget());
  document.getElementById("explore-help").addEventListener("click", (event) => {
    const panel = document.getElementById("explore-help-panel");
    panel.hidden = !panel.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  });

  const wheel = document.getElementById("explore-wheel");
  const pausePanel = document.getElementById("explore-pause");
  const pitPanel = document.getElementById("explore-pit");
  let pitPreviousFocus = null;
  let pausePreviousFocus = null;

  function pitWasSeen() {
    try { return sessionStorage.getItem(PIT_SESSION_KEY) === "seen"; }
    catch (_) { return true; }
  }

  function maybeOpenPit() {
    if (!state.entered || state.paused || state.wheelOpen || state.pitOpen || pitWasSeen()) return;
    if (state.activeSeconds < PIT_DELAY_SECONDS || state.visitedRegions.size < 2) return;
    try { sessionStorage.setItem(PIT_SESSION_KEY, "seen"); } catch (_) { return; }
    pitPreviousFocus = document.activeElement;
    state.pitOpen = true;
    window.ArticleAtlasPresence?.pause();
    pitPanel.hidden = false;
    stopAnimation();
    document.getElementById("explore-pit-dismiss").focus();
  }

  function closePit() {
    if (!state.pitOpen) return;
    state.pitOpen = false;
    pitPanel.hidden = true;
    const position = ownNormalizedPosition();
    window.ArticleAtlasPresence?.resume(position.x, position.y);
    if (pitPreviousFocus instanceof HTMLElement) pitPreviousFocus.focus({ preventScroll: true });
    else canvas.focus({ preventScroll: true });
    scheduleFrame();
  }

  function openWheel(x, y) {
    if (!state.entered || state.paused) return;
    const margin = 120;
    wheel.style.left = `${Math.max(margin, Math.min(state.width - margin, x))}px`;
    wheel.style.top = `${Math.max(margin, Math.min(state.height - margin, y))}px`;
    wheel.hidden = false;
    state.wheelOpen = true;
    wheel.querySelector('[data-wheel-action="read"]').disabled = !state.nearest;
    wheel.querySelector("button:not(:disabled)").focus();
  }

  function closeWheel() {
    wheel.hidden = true;
    state.wheelOpen = false;
    canvas.focus({ preventScroll: true });
  }

  function pauseExploring() {
    if (!state.entered || state.paused) return;
    pausePreviousFocus = document.activeElement;
    closeWheel();
    state.paused = true;
    window.ArticleAtlasPresence?.pause();
    pausePanel.hidden = false;
    stopAnimation();
    document.getElementById("explore-resume").focus();
  }

  function resumeExploring() {
    state.paused = false;
    pausePanel.hidden = true;
    state.pointer.active = false;
    const position = ownNormalizedPosition();
    window.ArticleAtlasPresence?.resume(position.x, position.y);
    if (pausePreviousFocus instanceof HTMLElement
      && pausePreviousFocus !== document.body
      && pausePreviousFocus.isConnected
      && !pausePreviousFocus.closest("[hidden]")) {
      pausePreviousFocus.focus({ preventScroll: true });
    } else {
      canvas.focus({ preventScroll: true });
    }
    scheduleFrame();
  }

  stage.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.active = true;
    updateNearest();
    openWheel(event.clientX, event.clientY);
  });

  wheel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-wheel-action]");
    if (!button) return;
    const action = button.dataset.wheelAction;
    if (action === "read" && state.nearest) navigateToArticle(state.nearest);
    if (action === "center") { focusArticle(startingArticle); closeWheel(); }
    if (action === "random") {
      const article = articles[Math.floor(Math.random() * articles.length)];
      focusArticle(article);
      closeWheel();
    }
    if (action === "react") {
      button.textContent = "♥";
      setTimeout(closeWheel, 220);
    }
    if (action === "pause") pauseExploring();
    if (action === "close") closeWheel();
  });

  document.getElementById("explore-resume").addEventListener("click", resumeExploring);
  document.getElementById("explore-pit-dismiss").addEventListener("click", closePit);
  pitPanel.addEventListener("click", (event) => {
    if (event.target === pitPanel) closePit();
  });
  document.addEventListener("keydown", (event) => {
    const activeModal = state.pitOpen ? pitPanel : state.paused ? pausePanel : null;
    if (activeModal && event.key === "Tab") {
      const focusable = [...activeModal.querySelectorAll("button, a[href]")].filter((element) => !element.hidden);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    } else if (event.key === "Escape" && state.pitOpen) closePit();
    else if (event.key === "Escape" && state.paused) resumeExploring();
    else if (event.key === "Escape" && state.wheelOpen) closeWheel();
    else if (event.key === "Escape" && state.lockedTarget) unlockTarget();
    else if (event.key === "Escape" && state.entered && !state.paused) pauseExploring();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state.entered) pauseExploring();
      else stopAnimation();
    } else if (!state.paused && !state.pitOpen) {
      scheduleFrame();
    }
  });

  if (window.ArticleAtlasPresence) window.ArticleAtlasPresence.subscribe(updatePresence);
  window.addEventListener("beforeunload", () => {
    window.ArticleAtlasPresence?.stop();
    riveOcean?.cleanup?.();
  });

  addEventListener("resize", () => {
    resize();
    if (state.frameId === null) renderWorld();
  });
  resize();
  loadAtlasManifest();
  scheduleFrame();
})();
