export function initHintable(element) {
  const tooltipText = element.dataset.tooltipText;

  if (tooltipText) {
    ["pointerenter", "focus"].forEach((eventType) =>
      element.addEventListener(eventType, handleShowHint),
    );
    ["pointerleave", "blur"].forEach((eventType) =>
      element.addEventListener(eventType, handleHideHint),
    );
  }
}

const handleShowHint = (e) => {};

const handleHideHint = (e) => {};
