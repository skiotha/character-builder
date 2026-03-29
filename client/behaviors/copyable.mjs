export function initCopyable(element) {
  const clipboardText = element.dataset.clipboardText;

  if (clipboardText) {
    element.addEventListener("pointerdown", async (e) => {
      if (e.target.tagName === "BUTTON") e.preventDefault();

      try {
        await navigator.clipboard.writeText(clipboardText);
        element.textContent = "Copied!";
        setTimeout(() => {
          element.textContent = clipboardText;
        }, 1500);
      } catch (error) {
        console.error("Copy failed:", error);
      }
    });
  }
}
