(() => {
  const GAP = 20;
  const MARGIN = 12;
  const HEADER_CLEARANCE = 76;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function forPointer(x, y, width, height, cardWidth, cardHeight) {
    const roomRight = width - x - GAP - MARGIN;
    const roomLeft = x - GAP - MARGIN;
    const side = roomRight >= cardWidth || roomRight >= roomLeft ? "right" : "left";
    const idealLeft = side === "right" ? x + GAP : x - GAP - cardWidth;
    const maximumLeft = Math.max(MARGIN, width - cardWidth - MARGIN);
    const maximumTop = Math.max(HEADER_CLEARANCE, height - cardHeight - MARGIN);
    return {
      side,
      left: clamp(idealLeft, MARGIN, maximumLeft),
      top: clamp(y - 40, HEADER_CLEARANCE, maximumTop)
    };
  }

  const docking = { forPointer };
  if (typeof window !== "undefined") window.ArticleAtlasPreviewDocking = docking;
  if (typeof module !== "undefined" && module.exports) module.exports = docking;
})();
