(() => {
  "use strict";
  function track(name, parameters = {}) {
    if (typeof window.gtag === "function") window.gtag("event", name, parameters);
  }
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-atlas-event]");
    if (!target) return;
    track(target.dataset.atlasEvent, {
      journey_id: target.dataset.journeyId || undefined,
      stop_id: target.dataset.stopId || undefined,
      link_url: target.href || undefined
    });
  });
  window.AtlasGrowth = Object.freeze({ track });
})();
