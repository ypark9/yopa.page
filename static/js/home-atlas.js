(() => {
  const canvas = document.getElementById("home-atlas-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { width: 0, height: 0, dpr: 1, time: 0 };
  const regions = [
    { name: "NEW POST CAMP", x: .5, y: .18, rx: .25, ry: .15, fill: "#f0ddb0", edge: "#a58755" },
    { name: "CLOUD HIGHLANDS", x: .25, y: .47, rx: .23, ry: .2, fill: "#d8e6cf", edge: "#789679" },
    { name: "AGENT GROVE", x: .73, y: .49, rx: .24, ry: .21, fill: "#b6d4b9", edge: "#547d60" },
    { name: "CODEWORKS", x: .35, y: .79, rx: .26, ry: .18, fill: "#d8d0b2", edge: "#8c805e" },
    { name: "ARCHIVE HARBOR", x: .78, y: .82, rx: .2, ry: .16, fill: "#b8d8d6", edge: "#59888d" }
  ];
  const simulatedVisitors = [
    { country: "KR", region: 0, phase: .3, color: "#ff7959" },
    { country: "US", region: 2, phase: 1.7, color: "#f5c85d" },
    { country: "JP", region: 1, phase: 3.2, color: "#6a94b4" },
    { country: "DE", region: 3, phase: 4.6, color: "#9b78ad" },
    { country: "CA", region: 4, phase: 5.5, color: "#e37b78" },
    { country: "GB", region: 2, phase: 6.1, color: "#67a87b" }
  ];
  let visitors = simulatedVisitors;

  function resize() {
    const box = canvas.getBoundingClientRect();
    state.width = box.width;
    state.height = box.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function point(region) {
    return {
      x: region.x * state.width,
      y: region.y * state.height,
      rx: region.rx * state.width,
      ry: region.ry * state.height
    };
  }

  function drawPath() {
    const stops = regions.map(point);
    ctx.beginPath();
    ctx.moveTo(stops[0].x, stops[0].y);
    stops.slice(1).forEach((stop, index) => {
      const previous = stops[index];
      const middleY = (previous.y + stop.y) / 2;
      ctx.bezierCurveTo(previous.x, middleY, stop.x, middleY, stop.x, stop.y);
    });
    ctx.strokeStyle = "rgba(79, 96, 85, .48)";
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 9]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRegion(region) {
    const p = point(region);
    ctx.beginPath();
    for (let step = 0; step <= 28; step += 1) {
      const angle = step / 28 * Math.PI * 2;
      const wobble = 1 + Math.sin(angle * 5 + region.x * 10) * .035;
      const x = p.x + Math.cos(angle) * p.rx * wobble;
      const y = p.y + Math.sin(angle) * p.ry * wobble;
      if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = region.fill;
    ctx.strokeStyle = region.edge;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(39, 60, 51, .72)";
    ctx.font = "700 10px ui-rounded, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(region.name, p.x, p.y - p.ry + 24);

    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2 + region.x;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(angle) * p.rx * .58, p.y + Math.sin(angle) * p.ry * .5, index % 2 ? 4 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = index % 2 ? "rgba(255,255,255,.7)" : "#ff835f";
      ctx.fill();
    }
  }

  function drawCursor(visitor) {
    let x;
    let y;
    if (Number.isFinite(visitor.x) && Number.isFinite(visitor.y)) {
      x = visitor.x * state.width;
      y = visitor.y * state.height;
    } else {
      const region = point(regions[visitor.region]);
      const drift = reducedMotion ? 0 : state.time * .00025;
      const angle = visitor.phase + drift;
      x = region.x + Math.cos(angle) * region.rx * .42;
      y = region.y + Math.sin(angle * 1.3) * region.ry * .35;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.42);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 19);
    ctx.lineTo(5, 14);
    ctx.lineTo(9, 23);
    ctx.lineTo(14, 21);
    ctx.lineTo(10, 12);
    ctx.lineTo(18, 11);
    ctx.closePath();
    ctx.globalAlpha = visitor.status === "paused" ? .42 : 1;
    ctx.fillStyle = visitor.color || colorFor(visitor.id);
    ctx.strokeStyle = "#273c33";
    ctx.lineWidth = 1.7;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(247,242,223,.94)";
    ctx.fillRect(x + 12, y - 11, 24, 15);
    ctx.fillStyle = "#273c33";
    ctx.font = "700 9px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(visitor.country, x + 16, y);
    ctx.globalAlpha = 1;
  }

  function colorFor(value = "visitor") {
    const colors = ["#ff7959", "#f5c85d", "#6a94b4", "#9b78ad", "#e37b78", "#67a87b"];
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
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
      visitors = simulatedVisitors;
      label.textContent = "Preview · simulated explorers";
    }
  }

  function render(time) {
    state.time = time;
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#c7ddc2";
    ctx.fillRect(0, 0, state.width, state.height);
    drawPath();
    regions.forEach(drawRegion);
    visitors.forEach(drawCursor);
    requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize);
  if (window.ArticleAtlasPresence) {
    window.ArticleAtlasPresence.subscribe(updatePresence);
    window.ArticleAtlasPresence.connect();
  }
  resize();
  requestAnimationFrame(render);
})();
