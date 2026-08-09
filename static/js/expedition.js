(() => {
  "use strict";
  const shell = document.querySelector("[data-expedition-id]");
  if (!shell) return;
  const journeyId = shell.dataset.expeditionId;
  const language = shell.dataset.expeditionLanguage;
  const key = `article-atlas-expedition-v1:${journeyId}:${language}`;
  const stops = [...shell.querySelectorAll(".expedition-stop[data-stop-id]")];
  const progress = document.getElementById("expedition-progress");
  const label = document.getElementById("expedition-progress-label");
  const completion = document.getElementById("expedition-complete");
  let state = { started: false, completed: [], completedOnce: false };

  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && Array.isArray(saved.completed)) {
      const validStopIds = new Set(stops.map((stop) => stop.dataset.stopId));
      state = {
        started: Boolean(saved.started),
        completed: [...new Set(saved.completed.filter((id) => validStopIds.has(id)))],
        completedOnce: Boolean(saved.completedOnce),
      };
    }
  } catch (_) { /* Storage is optional. */ }

  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { /* fail open */ }
  }

  function start() {
    if (state.started) return;
    state.started = true;
    window.AtlasGrowth?.track("expedition_start", { journey_id: journeyId });
  }

  function render() {
    const completed = new Set(state.completed);
    stops.forEach((stop) => {
      const done = completed.has(stop.dataset.stopId);
      stop.dataset.complete = String(done);
      const button = stop.querySelector(".expedition-mark");
      button.setAttribute("aria-pressed", String(done));
      button.textContent = done ? (language === "ko" ? "확인됨" : "Reviewed") : (language === "ko" ? "확인 완료" : "Mark reviewed");
    });
    progress.value = completed.size;
    label.textContent = language === "ko" ? `${stops.length}개 중 ${completed.size}개 완료` : `${completed.size} of ${stops.length} stops reviewed`;
    const done = completed.size === stops.length;
    completion.hidden = !done;
  }

  document.getElementById("expedition-start").addEventListener("click", () => {
    start();
    save();
    stops[0]?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  stops.forEach((stop) => stop.querySelector(".expedition-mark").addEventListener("click", () => {
    const id = stop.dataset.stopId;
    const completed = new Set(state.completed);
    const wasComplete = completed.has(id);
    if (wasComplete) completed.delete(id); else completed.add(id);
    start();
    state.completed = [...completed];
    const firstCompletion = completed.size === stops.length && !state.completedOnce;
    if (firstCompletion) state.completedOnce = true;
    save();
    render();
    if (!wasComplete) window.AtlasGrowth?.track("expedition_stop_complete", { journey_id: journeyId, stop_id: id });
    if (firstCompletion) {
      window.AtlasGrowth?.track("expedition_complete", { journey_id: journeyId });
      completion.focus();
    }
  }));

  window.AtlasGrowth?.track("expedition_view", { journey_id: journeyId });
  render();
})();
