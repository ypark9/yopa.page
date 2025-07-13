/**
 * Copy content for AI functionality
 * Copies the raw markdown content of a blog post to the clipboard
 */

document.addEventListener("DOMContentLoaded", function () {
  const copyButton = document.getElementById("copy-ai-button");
  const rawContentElement = document.getElementById("raw-markdown-content");

  if (!copyButton || !rawContentElement) {
    console.warn("Copy AI button or raw content element not found");
    return;
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
          document.execCommand("copy");
        } catch (err) {
          console.error("Fallback copy failed:", err);
          throw new Error("Copy failed");
        }

        document.body.removeChild(textArea);
      }

      // Provide user feedback
      const originalText = copyButton.textContent;
      copyButton.textContent = "✅ Copied!";
      copyButton.disabled = true;

      // Reset button after 2 seconds
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.disabled = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy content:", err);

      // Show error feedback
      const originalText = copyButton.textContent;
      copyButton.textContent = "❌ Copy failed";

      // Reset button after 2 seconds
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 2000);
    }
  });
});
