/**
 * Portrait component override.
 * Renders the portrait section for both existing portraits (with crop transform)
 * and empty/upload-ready placeholders.
 *
 * DOM contract (consumed by portraitHandler.mjs):
 *   section#portrait
 *     > div[role="region"]             — drop zone / pan-zoom target
 *       > div#portrait-placeholder     — shown when no portrait
 *       > div#portrait-preview         — shown when portrait exists
 *         > img                        — portrait image
 *     > input[type="file"]#portrait-input
 *
 * @param {string} path - Schema field path (e.g. "portrait")
 * @param {object} fieldSchema - Serialized schema field descriptor
 * @param {*} value - Portrait data object or null/undefined
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
export function renderPortrait(path, fieldSchema, value, role) {
  const section = document.createElement("section");
  section.id = "portrait";
  section.dataset.path = path;

  const hasPortrait = value?.path && value?.status === "uploaded";

  if (hasPortrait) {
    section.dataset.portrait = "loaded";
  }

  // Drop zone / pan-zoom container
  const dropZone = document.createElement("div");
  dropZone.setAttribute("role", "region");
  dropZone.setAttribute(
    "aria-label",
    hasPortrait ? "Portrait" : "Portrait upload area",
  );
  dropZone.setAttribute("tabindex", "-1");

  // Placeholder (hidden when portrait exists)
  const placeholder = document.createElement("div");
  placeholder.id = "portrait-placeholder";
  placeholder.hidden = hasPortrait;

  const placeholderLabel = document.createElement("span");
  placeholderLabel.textContent = "Portrait";
  placeholder.appendChild(placeholderLabel);

  const plusIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  plusIcon.setAttribute("role", "img");
  plusIcon.setAttribute("aria-label", "Upload portrait");
  const plusUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
  plusUse.setAttribute("href", "/common/icons/icon-plus-2.svg");
  plusIcon.appendChild(plusUse);
  placeholder.appendChild(plusIcon);

  dropZone.appendChild(placeholder);

  // Preview container
  const preview = document.createElement("div");
  preview.id = "portrait-preview";
  preview.hidden = !hasPortrait;

  const img = document.createElement("img");
  img.alt = "Character portrait";

  if (hasPortrait) {
    img.src = value.path;
    const crop = value.crop;
    if (crop) {
      img.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${crop.rotation ?? 0}deg)`;
    }
  }

  preview.appendChild(img);
  dropZone.appendChild(preview);

  section.appendChild(dropZone);

  // File input (always present for upload support)
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = "portrait-input";
  fileInput.accept =
    "image/png, image/jpeg, image/jpg, image/webp, image/gif, image/avif";
  fileInput.setAttribute("aria-label", "Upload portrait image");

  section.appendChild(fileInput);

  return section;
}
