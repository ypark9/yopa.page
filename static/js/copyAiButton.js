/**
 * Copy content for AI functionality
 * Copies the raw markdown content of a blog post to the clipboard
 */

document.addEventListener("DOMContentLoaded", function () {
  const copyButton = document.getElementById("copy-ai-button");
  const rawContentElement = document.getElementById("raw-markdown-content");

  if (!copyButton || !rawContentElement) {
    return;
  }

  const labelElement = copyButton.querySelector(".copy-ai-label");
  const defaultLabel = copyButton.dataset.defaultLabel || "Copy for AI";
  const successLabel = copyButton.dataset.successLabel || "Copied";
  const errorLabel = copyButton.dataset.errorLabel || "Copy failed";
  let resetTimer;

  function setButtonState(state, label, disabled) {
    window.clearTimeout(resetTimer);
    copyButton.dataset.state = state;
    copyButton.disabled = disabled;
    labelElement.textContent = label;

    resetTimer = window.setTimeout(() => {
      delete copyButton.dataset.state;
      copyButton.disabled = false;
      labelElement.textContent = defaultLabel;
    }, 2000);
  }

  copyButton.addEventListener("click", async function () {
    try {
      const markdownContent = rawContentElement.textContent;

      // Use the modern Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(markdownContent);
      } else {
        // Fallback for older browsers or non-HTTPS contexts
        const textArea = document.createElement("textarea");
        textArea.value = markdownContent;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          if (!document.execCommand("copy")) {
            throw new Error("Copy command was rejected");
          }
        } catch (err) {
          console.error("Fallback copy failed:", err);
          throw new Error("Copy failed");
        } finally {
          document.body.removeChild(textArea);
        }
      }

      setButtonState("success", successLabel, true);
    } catch (err) {
      console.error("Failed to copy content:", err);
      setButtonState("error", errorLabel, false);
    }
  });
});
