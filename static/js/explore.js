(() => {
  const canvas = document.getElementById("explore-world");
  const shell = document.getElementById("explore-shell");
  const payload = document.getElementById("explore-posts");
  if (!canvas || !shell || !payload) return;

  const ctx = canvas.getContext("2d");
  const posts = JSON.parse(payload.textContent || "[]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SESSION_KEY = "article-atlas-navigation-v1";
  const PIT_SESSION_KEY = "article-atlas-server-cost-pit-v1";
  const PIT_DELAY_SECONDS = 60;
  const world = { minX: -1450, maxX: 1450, minY: -550, maxY: 6650 };
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
    { id: "cloud", x: -420, y: 250, rx: 830, ry: 650 },
    { id: "agents", x: 470, y: 1320, rx: 790, ry: 680 },
    { id: "code", x: -440, y: 2470, rx: 850, ry: 720 },
    { id: "salesforce", x: 470, y: 3570, rx: 760, ry: 650 },
    { id: "python", x: -440, y: 4520, rx: 700, ry: 600 },
    { id: "engineering", x: 470, y: 5450, rx: 760, ry: 620 },
    { id: "archive", x: -380, y: 6280, rx: 660, ry: 430 }
  ];
  const state = {
    width: 0, height: 0, dpr: 1,
    camera: { x: 0, y: 0 },
    pointer: { x: innerWidth / 2, y: innerHeight / 2, active: false },
    entered: false,
    paused: false,
    wheelOpen: false,
    nearest: null,
    waypoint: null,
    visitedRegions: new Set(),
    activeSeconds: 0,
    lastTick: null,
    pitOpen: false,
    time: 0
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

  const simulatedVisitors = Array.from({ length: 11 }, (_, index) => {
    const random = hash(`visitor-${index}`);
    const country = ["KR", "US", "CA", "DE", "JP", "BR", "GB"][index % 7];
    return {
      x: world.minX + random() * (world.maxX - world.minX),
      y: world.minY + random() * (world.maxY - world.minY),
      phase: random() * 8,
      country,
      live: false
    };
  });
  let visitors = simulatedVisitors;
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
      visitors = simulatedVisitors;
      if (label) label.textContent = "Prototype · simulated visitors";
    }
  }

  function resize() {
    state.width = innerWidth;
    state.height = innerHeight;
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function screen(worldX, worldY) {
    return { x: worldX - state.camera.x + state.width / 2, y: worldY - state.camera.y + state.height / 2 };
  }

  function blob(region) {
    const p = screen(region.x, region.y);
    const colors = palette[region.id];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    for (let i = 0; i <= 24; i += 1) {
      const angle = (i / 24) * Math.PI * 2;
      const wobble = 1 + Math.sin(angle * 5 + region.x) * .035 + Math.cos(angle * 3) * .025;
      const x = Math.cos(angle) * region.rx * wobble;
      const y = Math.sin(angle) * region.ry * wobble;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.fill();
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
    if (state.waypoint === article) {
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
    if (!state.pointer.active || !state.entered || state.paused) return;
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
    state.waypoint = article;
    document.getElementById("explore-waypoint-title").textContent = article.title;
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
    if (distance < 82) {
      const destination = state.waypoint;
      clearWaypoint();
      selectArticle(destination);
    }
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

  function tick(time) {
    state.time = time;
    const elapsed = state.lastTick === null ? 0 : Math.min(.1, (time - state.lastTick) / 1000);
    state.lastTick = time;
    if (state.entered && state.pointer.active && !state.paused && !state.wheelOpen && !state.pitOpen) {
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
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#c9dfc4"; ctx.fillRect(0, 0, state.width, state.height);
    regions.forEach(blob);
    regions.forEach(landscape);
    articles.forEach(drawArticle);
    visitors.forEach(drawVisitor);
    drawOwnCursor();
    updateNearest();
    updateWaypoint();
    maybeOpenPit();
    requestAnimationFrame(tick);
  }

  canvas.addEventListener("pointermove", (event) => {
    if (state.paused) return;
    state.pointer.x = event.clientX; state.pointer.y = event.clientY; state.pointer.active = true;
  });
  canvas.addEventListener("pointerleave", () => { state.pointer.active = false; });
  canvas.addEventListener("click", () => {
    if (state.wheelOpen) { closeWheel(); return; }
    if (state.nearest) navigateToArticle(state.nearest);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    state.pointer.x = event.clientX; state.pointer.y = event.clientY; state.pointer.active = true;
  });

  document.getElementById("explore-enter").addEventListener("click", () => {
    state.entered = true;
    window.ArticleAtlasPresence?.connect();
    if (requestedArticle) {
      if (!restoreNavigation(requestedArticle)) focusArticle(requestedArticle);
      else selectArticle(requestedArticle);
    }
    const intro = document.getElementById("explore-intro");
    intro.classList.add("is-leaving");
    setTimeout(() => { intro.hidden = true; }, reducedMotion ? 0 : 360);
  });
  document.getElementById("explore-card-link").addEventListener("click", () => saveNavigation(state.nearest));
  document.getElementById("explore-card-related").addEventListener("click", (event) => {
    const button = event.target.closest("[data-article-url]");
    if (!button) return;
    setWaypoint(articleByPath.get(normalizePath(button.dataset.articleUrl)));
  });
  document.getElementById("explore-waypoint-cancel").addEventListener("click", clearWaypoint);
  document.getElementById("explore-help").addEventListener("click", (event) => {
    const panel = document.getElementById("explore-help-panel");
    panel.hidden = !panel.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  });

  const wheel = document.getElementById("explore-wheel");
  const pausePanel = document.getElementById("explore-pause");
  const pitPanel = document.getElementById("explore-pit");
  let pitPreviousFocus = null;

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
    state.pointer.active = false;
    window.ArticleAtlasPresence?.pause();
    pitPanel.hidden = false;
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
    closeWheel();
    state.paused = true;
    window.ArticleAtlasPresence?.pause();
    pausePanel.hidden = false;
    document.getElementById("explore-resume").focus();
  }

  function resumeExploring() {
    state.paused = false;
    pausePanel.hidden = true;
    state.pointer.active = false;
    const position = ownNormalizedPosition();
    window.ArticleAtlasPresence?.resume(position.x, position.y);
    canvas.focus({ preventScroll: true });
  }

  canvas.addEventListener("contextmenu", (event) => {
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
    if (state.pitOpen && event.key === "Tab") {
      const focusable = [...pitPanel.querySelectorAll("button, a[href]")].filter((element) => !element.hidden);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    } else if (event.key === "Escape" && state.pitOpen) closePit();
    else if (event.key === "Escape" && state.wheelOpen) closeWheel();
    else if (event.key === "Escape" && state.entered && !state.paused) pauseExploring();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseExploring();
  });

  if (window.ArticleAtlasPresence) window.ArticleAtlasPresence.subscribe(updatePresence);
  window.addEventListener("beforeunload", () => window.ArticleAtlasPresence?.stop());

  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(tick);
})();
