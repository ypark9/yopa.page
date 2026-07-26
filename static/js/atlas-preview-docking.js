(() => {
  const LOW = 0.35;
  const HIGH = 0.65;

  function band(value, length) {
    const position = length > 0 ? value / length : 0.5;
    if (position < LOW) return "left";
    if (position > HIGH) return "right";
    return "center";
  }

  function verticalBand(value, length) {
    const position = length > 0 ? value / length : 0.5;
    if (position < LOW) return "top";
    if (position > HIGH) return "bottom";
    return "center";
  }

  function forPointer(x, y, width, height) {
    const pointerRegion = `${band(x, width)}-${verticalBand(y, height)}`;
    return {
      "left-top": "bottom-right",
      "left-center": "center-right",
      "left-bottom": "top-right",
      "center-top": "bottom-center",
      "center-center": "bottom-left",
      "center-bottom": "top-center",
      "right-top": "bottom-left",
      "right-center": "center-left",
      "right-bottom": "top-left"
    }[pointerRegion];
  }

  const docking = { forPointer };
  if (typeof window !== "undefined") window.ArticleAtlasPreviewDocking = docking;
  if (typeof module !== "undefined" && module.exports) module.exports = docking;
})();
