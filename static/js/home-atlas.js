(() => {
  const canvas = document.getElementById("home-atlas-canvas");
  const shell = canvas?.closest(".home-atlas");
  if (!canvas || !shell) return;

  const ctx = canvas.getContext("2d");
  const state = { width: 0, height: 0, dpr: 1 };
  const assetRoot = new URL(shell.dataset.atlasAssets || "", location.href);
  const images = new Map();
  let manifest = null;
  let visitors = [];

  const fallbackRegions = [
    { id: "cloud", name: "Cloud Highlands", x: -2468, y: 250, rx: 830, ry: 650, fill: "#d8e6cf", edge: "#7aa17b" },
    { id: "agents", name: "Agent Grove", x: 470, y: 296, rx: 790, ry: 680, fill: "#b9d9c1", edge: "#568b68" },
    { id: "engineering", name: "Engineering Ridge", x: 2518, y: 330, rx: 760, ry: 620, fill: "#c9c4dc", edge: "#777091" },
    { id: "code", name: "Codeworks", x: -2488, y: 1958, rx: 850, ry: 720, fill: "#d8d1b6", edge: "#8f8260" },
    { id: "salesforce", name: "Salesforce Springs", x: 470, y: 2034, rx: 760, ry: 650, fill: "#b9d9dc", edge: "#568f99" },
    { id: "python", name: "Python Meadow", x: 2120, y: 1960, rx: 700, ry: 600, fill: "#d9dba9", edge: "#8d9156" },
    { id: "archive", name: "Archive Harbor", x: 132, y: 3208, rx: 660, ry: 430, fill: "#c5ddd8", edge: "#668e87" }
  ];

  function worldBounds() {
    const world = manifest?.world;
    return world
      ? { left: world.originX, top: world.originY, width: world.width, height: world.height }
      : { left: -3584, top: -768, width: 7168, height: 5120 };
  }

  function transform() {
    const bounds = worldBounds();
    const padding = Math.min(28, state.width * .05);
    const scale = Math.min(
      (state.width - padding * 2) / bounds.width,
      (state.height - padding * 2) / bounds.height
    );
    return {
      scale,
      x: (state.width - bounds.width * scale) / 2 - bounds.left * scale,
      y: (state.height - bounds.height * scale) / 2 - bounds.top * scale
    };
  }

  function point(x, y) {
    const view = transform();
    return { x: view.x + x * view.scale, y: view.y + y * view.scale, scale: view.scale };
  }

  function ensureImage(source) {
    if (!source) return null;
    if (images.has(source)) return images.get(source);
    const entry = { image: new Image(), status: "loading" };
    entry.image.decoding = "async";
    entry.image.onload = () => {
      entry.status = "ready";
      render();
    };
    entry.image.onerror = () => {
      entry.status = "error";
    };
    const url = new URL(source, assetRoot);
    if (manifest?.revision) url.searchParams.set("v", manifest.revision);
    entry.image.src = url.href;
    images.set(source, entry);
    return entry;
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    state.width = box.width;
    state.height = box.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    render();
  }

  function traceRegion(region) {
    const p = point(region.x, region.y);
    ctx.beginPath();
    const steps = 72;
    for (let step = 0; step <= steps; step += 1) {
      const angle = step / steps * Math.PI * 2;
      const wobble = 1 + Math.sin(angle * 5 + region.x) * .035;
      const x = p.x + Math.cos(angle) * region.rx * p.scale * wobble;
      const y = p.y + Math.sin(angle) * region.ry * p.scale * wobble;
      if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawPath(regions) {
    const byId = new Map(regions.map((region) => [region.id, region]));
    const connections = manifest?.connections || [];
    if (!connections.length) return;
    ctx.beginPath();
    connections.forEach(([fromId, toId]) => {
      const fromRegion = byId.get(fromId);
      const toRegion = byId.get(toId);
      if (!fromRegion || !toRegion) return;
      const from = point(fromRegion.x, fromRegion.y);
      const to = point(toRegion.x, toRegion.y);
      const bend = Math.min(45, Math.abs(to.x - from.x) * .08);
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(from.x + bend, from.y, to.x - bend, to.y, to.x, to.y);
    });
    ctx.strokeStyle = "rgba(79, 96, 85, .48)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRegion(region) {
    traceRegion(region);
    ctx.fillStyle = region.fill;
    ctx.strokeStyle = region.edge;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  }

  function drawTiles() {
    if (!manifest) return;
    const size = manifest.tileSize;
    const originX = manifest.world.originX;
    const originY = manifest.world.originY;
    const groups = new Map();
    (manifest.tiles.base || []).forEach((tile) => {
      const regionId = tile.region || "";
      if (!groups.has(regionId)) groups.set(regionId, []);
      groups.get(regionId).push(tile);
    });
    groups.forEach((tiles, regionId) => {
      ctx.save();
      const region = manifest.regions?.find((item) => item.id === regionId);
      if (region) {
        traceRegion(region);
        ctx.clip();
      }
      tiles.forEach((tile) => {
        const asset = ensureImage(tile.src);
        if (asset?.status !== "ready") return;
        const p = point(originX + tile.x * size, originY + tile.y * size);
        const scaled = size * p.scale;
        ctx.drawImage(asset.image, p.x - .5, p.y - .5, scaled + 1, scaled + 1);
      });
      ctx.restore();
    });
  }

  function drawObjects(layer) {
    if (!manifest) return;
    const groups = new Map();
    manifest.objects
      .filter((item) => item.layer === layer)
      .forEach((item) => {
        const regionId = item.region || "";
        if (!groups.has(regionId)) groups.set(regionId, []);
        groups.get(regionId).push(item);
      });
    groups.forEach((items, regionId) => {
      ctx.save();
      const region = manifest.regions?.find((item) => item.id === regionId);
      if (region) {
        traceRegion(region);
        ctx.clip();
      }
      items
        .sort((a, b) => a.y - b.y)
        .forEach((item) => {
        const asset = ensureImage(item.src);
        if (asset?.status !== "ready") return;
        const p = point(item.x, item.y);
        const width = item.width * p.scale;
        const height = width * asset.image.naturalHeight / asset.image.naturalWidth;
        ctx.drawImage(
          asset.image,
          p.x - width * (item.anchorX ?? .5),
          p.y - height * (item.anchorY ?? .5),
          width,
          height
        );
      });
      ctx.restore();
    });
  }

  function drawCursor(visitor) {
    if (!Number.isFinite(visitor.x) || !Number.isFinite(visitor.y)) return;
    const bounds = worldBounds();
    const p = point(
      bounds.left + visitor.x * bounds.width,
      bounds.top + visitor.y * bounds.height
    );
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-.42);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(4, 11);
    ctx.lineTo(8, 19);
    ctx.lineTo(12, 17);
    ctx.lineTo(8, 10);
    ctx.lineTo(14, 9);
    ctx.closePath();
    ctx.globalAlpha = visitor.status === "paused" ? .42 : 1;
    ctx.fillStyle = colorFor(visitor.id);
    ctx.strokeStyle = "#273c33";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function colorFor(value = "visitor") {
    const colors = ["#ff7959", "#f5c85d", "#6a94b4", "#9b78ad", "#e37b78", "#67a87b"];
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function updatePresence(event) {
    const label = document.querySelector("#home-atlas-presence span:last-child");
    if (!label) return;
    if (event.mode === "live") {
      visitors = event.visitors;
      label.textContent = visitors.length ? `${visitors.length} explorers online` : "Be the first explorer";
    } else if (event.mode === "connecting") {
      label.textContent = "Connecting to the atlas…";
    } else if (event.mode === "offline") {
      visitors = [];
      label.textContent = "Atlas is quiet right now";
    } else {
      visitors = [];
      label.textContent = "Solo exploration · live presence off";
    }
    render();
  }

  function render() {
    const regions = manifest?.regions || fallbackRegions;
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#c7ddc2";
    ctx.fillRect(0, 0, state.width, state.height);
    drawPath(regions);
    regions.forEach(drawRegion);
    drawTiles();
    drawObjects("world");
    visitors.forEach(drawCursor);
    drawObjects("top");
  }

  async function loadManifest() {
    try {
      const response = await fetch(shell.dataset.atlasManifest, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Atlas manifest ${response.status}`);
      const candidate = await response.json();
      if (candidate.version !== 1 || candidate.tileSize !== 512) throw new Error("Unsupported atlas manifest");
      manifest = candidate;
      render();
    } catch (_) {
      manifest = null;
      render();
    }
  }

  window.addEventListener("resize", resize);
  if (window.ArticleAtlasPresence) {
    window.ArticleAtlasPresence.subscribe(updatePresence);
    window.ArticleAtlasPresence.connect();
  }
  resize();
  loadManifest();
})();
