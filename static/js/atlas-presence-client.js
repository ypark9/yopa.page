(() => {
  const productionHosts = new Set(["www.yopa.page", "yopa.page"]);
  const configured = document.currentScript?.dataset.enabled === "true";
  const subscribers = new Set();
  const state = {
    socket: null, visitorId: null, country: "XX", visitors: [], reconnectAttempt: 0,
    reconnectTimer: null, heartbeatTimer: null, snapshotTimer: null, lastMoveAt: 0,
    lastPosition: { x: .5, y: .12 }, stopped: false
  };

  function enabled() {
    return configured && location.protocol === "https:" && productionHosts.has(location.hostname);
  }

  function emit(mode, detail = {}) {
    const event = { mode, visitorId: state.visitorId, country: state.country, visitors: state.visitors, ...detail };
    subscribers.forEach((subscriber) => subscriber(event));
  }

  function send(payload) {
    if (state.socket?.readyState !== WebSocket.OPEN) return false;
    state.socket.send(JSON.stringify(payload));
    return true;
  }

  function validVisitor(visitor) {
    return visitor && typeof visitor.id === "string" && /^[A-Z]{2}$/.test(visitor.country)
      && Number.isFinite(visitor.x) && visitor.x >= 0 && visitor.x <= 1
      && Number.isFinite(visitor.y) && visitor.y >= 0 && visitor.y <= 1
      && ["active", "paused"].includes(visitor.status) && Number.isFinite(visitor.lastSeen);
  }

  function receive(event) {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "welcome" && typeof message.visitorId === "string") {
      state.visitorId = message.visitorId;
      state.country = /^[A-Z]{2}$/.test(message.country) ? message.country : "XX";
    }
    if (["welcome", "snapshot"].includes(message.type) && Array.isArray(message.visitors)) {
      const cutoff = Date.now() - 60000;
      state.visitors = message.visitors.filter(validVisitor).filter((visitor) => visitor.lastSeen > cutoff).slice(0, 20);
      emit("live", { serverTime: message.serverTime });
    }
  }

  function scheduleReconnect() {
    if (state.stopped || state.reconnectTimer) return;
    const base = Math.min(30000, 1000 * (2 ** state.reconnectAttempt));
    const delay = Math.round(base * (.75 + Math.random() * .5));
    state.reconnectAttempt += 1;
    state.reconnectTimer = setTimeout(() => { state.reconnectTimer = null; connect(); }, delay);
  }

  function connect() {
    if (!enabled()) { emit("simulated"); return; }
    if (state.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)) return;
    state.stopped = false;
    emit("connecting");
    state.socket = new WebSocket(`wss://${location.host}/presence`);
    state.socket.addEventListener("open", () => {
      state.reconnectAttempt = 0;
      send({ action: "hello" });
      clearInterval(state.heartbeatTimer);
      clearInterval(state.snapshotTimer);
      state.heartbeatTimer = setInterval(() => send({ action: "heartbeat" }), 30000);
      state.snapshotTimer = setInterval(() => send({ action: "snapshot" }), 5000);
    });
    state.socket.addEventListener("message", receive);
    state.socket.addEventListener("close", () => {
      clearInterval(state.heartbeatTimer);
      clearInterval(state.snapshotTimer);
      state.heartbeatTimer = null;
      state.snapshotTimer = null;
      state.socket = null;
      state.visitors = [];
      emit("offline");
      scheduleReconnect();
    });
    state.socket.addEventListener("error", () => state.socket?.close());
  }

  function normalized(value) { return Math.max(0, Math.min(1, Number(value))); }

  function move(x, y) {
    state.lastPosition = { x: normalized(x), y: normalized(y) };
    const current = Date.now();
    if (current - state.lastMoveAt < 5000) return;
    state.lastMoveAt = current;
    send({ action: "move", ...state.lastPosition });
  }

  function pause() { send({ action: "pause" }); }

  function resume(x = state.lastPosition.x, y = state.lastPosition.y) {
    state.lastPosition = { x: normalized(x), y: normalized(y) };
    send({ action: "resume", ...state.lastPosition });
  }

  function stop() {
    state.stopped = true;
    clearTimeout(state.reconnectTimer);
    clearInterval(state.heartbeatTimer);
    clearInterval(state.snapshotTimer);
    state.reconnectTimer = null;
    state.heartbeatTimer = null;
    state.snapshotTimer = null;
    state.socket?.close();
    state.socket = null;
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    subscriber({ mode: enabled() ? "connecting" : "simulated", visitorId: state.visitorId, country: state.country, visitors: state.visitors });
    return () => subscribers.delete(subscriber);
  }

  window.ArticleAtlasPresence = { connect, enabled, move, pause, resume, stop, subscribe };
})();
