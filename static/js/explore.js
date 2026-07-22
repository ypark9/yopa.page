(() => {
  const canvas = document.getElementById("explore-world");
  const shell = document.getElementById("explore-shell");
  const payload = document.getElementById("explore-posts");
  if (!canvas || !shell || !payload) return;

  const ctx = canvas.getContext("2d");
  const posts = JSON.parse(payload.textContent || "[]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const palette = {
    cloud: { name: "Cloud Highlands", fill: "#d8e6cf", edge: "#7aa17b", beacon: "#ff8b5c" },
    agents: { name: "Agent Grove", fill: "#b9d9c1", edge: "#568b68", beacon: "#ffe37b" },
    code: { name: "Codeworks", fill: "#d8d1b6", edge: "#8f8260", beacon: "#f58c77" },
    salesforce: { name: "Salesforce Springs", fill: "#b9d9dc", edge: "#568f99", beacon: "#ffd873" },
    python: { name: "Python Meadow", fill: "#d9dba9", edge: "#8d9156", beacon: "#ed8a65" }
  };
  const regions = [
    { id: "cloud", x: 0, y: 0, rx: 460, ry: 350 },
    { id: "agents", x: 650, y: 540, rx: 430, ry: 360 },
    { id: "code", x: -540, y: 760, rx: 470, ry: 390 },
    { id: "salesforce", x: 460, y: 1370, rx: 450, ry: 350 },
    { id: "python", x: -430, y: 1660, rx: 400, ry: 330 }
  ];
  const state = {
    width: 0, height: 0, dpr: 1,
    camera: { x: 0, y: -70 },
    pointer: { x: innerWidth / 2, y: innerHeight / 2, active: false },
    entered: false,
    paused: false,
    wheelOpen: false,
    nearest: null,
    time: 0
  };

  function regionFor(post) {
    const cats = (post.categories || []).map((category) => String(category).toLowerCase());
    if (cats.some((c) => c.includes("aws") || c.includes("cloud") || c.includes("devops"))) return "cloud";
    if (cats.some((c) => c.includes("ai") || c.includes("agent") || c.includes("bedrock") || c.includes("engineering"))) return "agents";
    if (cats.some((c) => c.includes("salesforce"))) return "salesforce";
    if (cats.some((c) => c.includes("python"))) return "python";
    return "code";
  }

  function hash(value) {
    let result = 2166136261;
    for (let i = 0; i < value.length; i += 1) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
    return () => ((result = Math.imul(result ^ (result >>> 13), 1274126177)) >>> 0) / 4294967295;
  }

  const regionCounts = Object.fromEntries(regions.map((region) => [region.id, 0]));
  const selectedPosts = posts.filter((post) => {
    const regionId = regionFor(post);
    if (regionCounts[regionId] >= 6) return false;
    regionCounts[regionId] += 1;
    return true;
  });

  const articles = selectedPosts.map((post, index) => {
    const regionId = regionFor(post);
    const region = regions.find((item) => item.id === regionId);
    const random = hash(post.url);
    const angle = random() * Math.PI * 2;
    const radius = .2 + random() * .68;
    return {
      ...post,
      regionId,
      x: region.x + Math.cos(angle) * region.rx * radius,
      y: region.y + Math.sin(angle) * region.ry * radius,
      size: index < 8 ? 12 : 9
    };
  });

  const visitors = Array.from({ length: 11 }, (_, index) => {
    const random = hash(`visitor-${index}`);
    const country = ["KR", "US", "CA", "DE", "JP", "BR", "GB"][index % 7];
    return { x: (random() - .5) * 1100, y: random() * 1900, phase: random() * 8, country };
  });

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
    const drift = reducedMotion ? 0 : Math.sin(state.time * .00045 + visitor.phase) * 32;
    const p = screen(visitor.x + drift, visitor.y + Math.cos(state.time * .00038 + visitor.phase) * 20);
    if (p.x < -50 || p.y < -50 || p.x > state.width + 50 || p.y > state.height + 50) return;
    ctx.save();
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
    ctx.fillStyle = "rgba(245,240,223,.9)";
    ctx.fillRect(p.x + 13, p.y - 12, 25, 15);
    ctx.fillStyle = "#263b32";
    ctx.font = "800 9px system-ui";
    ctx.fillText(visitor.country, p.x + 18, p.y - 1);
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

  function updateNearest() {
    if (!state.entered || !state.pointer.active || state.paused || state.wheelOpen) return;
    const worldX = state.camera.x + state.pointer.x - state.width / 2;
    const worldY = state.camera.y + state.pointer.y - state.height / 2;
    let nearest = null;
    let best = 82;
    articles.forEach((article) => {
      const distance = Math.hypot(article.x - worldX, article.y - worldY);
      if (distance < best) { best = distance; nearest = article; }
    });
    if (nearest === state.nearest) return;
    state.nearest = nearest;
    const card = document.getElementById("explore-card");
    if (!nearest) { card.hidden = true; return; }
    document.getElementById("explore-card-region").textContent = palette[nearest.regionId].name;
    document.getElementById("explore-card-title").textContent = nearest.title;
    document.getElementById("explore-card-description").textContent = nearest.description;
    document.getElementById("explore-card-date").textContent = nearest.date;
    document.getElementById("explore-card-link").href = nearest.url;
    card.hidden = false;
  }

  function tick(time) {
    state.time = time;
    if (state.entered && state.pointer.active && !state.paused && !state.wheelOpen) {
      const nx = state.pointer.x / state.width * 2 - 1;
      const ny = state.pointer.y / state.height * 2 - 1;
      const edgeX = Math.abs(nx) > .62 ? Math.sign(nx) * ((Math.abs(nx) - .62) / .38) : 0;
      const edgeY = Math.abs(ny) > .56 ? Math.sign(ny) * ((Math.abs(ny) - .56) / .44) : 0;
      state.camera.x += edgeX * 7;
      state.camera.y += edgeY * 7;
      state.camera.x = Math.max(-760, Math.min(820, state.camera.x));
      state.camera.y = Math.max(-250, Math.min(1930, state.camera.y));
    }
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#c9dfc4"; ctx.fillRect(0, 0, state.width, state.height);
    regions.forEach(blob);
    regions.forEach(landscape);
    articles.forEach(drawArticle);
    visitors.forEach(drawVisitor);
    drawOwnCursor();
    updateNearest();
    requestAnimationFrame(tick);
  }

  canvas.addEventListener("pointermove", (event) => {
    if (state.paused) return;
    state.pointer.x = event.clientX; state.pointer.y = event.clientY; state.pointer.active = true;
  });
  canvas.addEventListener("pointerleave", () => { state.pointer.active = false; });
  canvas.addEventListener("click", () => {
    if (state.wheelOpen) { closeWheel(); return; }
    if (state.nearest) window.location.href = state.nearest.url;
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    state.pointer.x = event.clientX; state.pointer.y = event.clientY; state.pointer.active = true;
  });

  document.getElementById("explore-enter").addEventListener("click", () => {
    state.entered = true;
    const intro = document.getElementById("explore-intro");
    intro.classList.add("is-leaving");
    setTimeout(() => { intro.hidden = true; }, reducedMotion ? 0 : 360);
  });
  document.getElementById("explore-help").addEventListener("click", (event) => {
    const panel = document.getElementById("explore-help-panel");
    panel.hidden = !panel.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  });

  const wheel = document.getElementById("explore-wheel");
  const pausePanel = document.getElementById("explore-pause");

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
    pausePanel.hidden = false;
    document.getElementById("explore-resume").focus();
  }

  function resumeExploring() {
    state.paused = false;
    pausePanel.hidden = true;
    state.pointer.active = false;
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
    if (action === "read" && state.nearest) window.location.href = state.nearest.url;
    if (action === "center") { state.camera.x = 0; state.camera.y = -70; closeWheel(); }
    if (action === "random") {
      const article = articles[Math.floor(Math.random() * articles.length)];
      state.camera.x = article.x;
      state.camera.y = article.y;
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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.wheelOpen) closeWheel();
    else if (event.key === "Escape" && state.entered && !state.paused) pauseExploring();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseExploring();
  });

  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(tick);
})();
