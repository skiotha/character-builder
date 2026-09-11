/**
 * `<nagara-portrait>` — portrait section component override (ADR-017).
 *
 * Renders the portrait drop zone / preview once and then patches it in
 * place (`src`, `transform`, `hidden`, `data-portrait`) on every `portrait`
 * subtree change, because `portraitHandler.mjs` captures the inner nodes
 * at init and must keep pointing at the same DOM.
 *
 * The element owns the upload handler in both modes when the field is
 * writable for the current role. In `create` mode the handler only stages
 * the file locally; the creation form reads it back via `getPortraitData()`
 * on submit. In `view` mode a picked file is uploaded immediately, then the
 * crop is PATCHed as six leaves (`portrait.crop.{x,y,scale,rotation}`,
 * `portrait.dimensions.{width,height}`) — the `portrait.crop` node itself
 * carries no permissions, so a wholesale crop write is rejected. Settled
 * pan / zoom gestures PATCH the same six leaves; each new PATCH aborts the
 * previous in-flight one.
 *
 * While a local editing session is active (the handler holds an object URL
 * for a freshly picked file) incoming renders are skipped so the server
 * echo does not fight the preview; the session lasts until disconnect.
 *
 * DOM contract (consumed by portraitHandler.mjs):
 *   section#portrait
 *     > div[role="region"]             — drop zone / pan-zoom target
 *       > div#portrait-placeholder     — shown when no portrait
 *       > div#portrait-preview         — shown when portrait exists
 *         > img                        — portrait image
 *     > input[type="file"]#portrait-input
 *
 * No descendant carries `data-path` — the view's leaf binding
 * (ADR-017 §leaf-binding) must not pick up the file input.
 */

import * as api from "api";
import { initPortraitUpload } from "../behaviors/portraitHandler.mjs";
import { setCurrentCharacter } from "../state.mjs";
import { NagaraElement, componentFactory, isWritable } from "./base.mjs";

const ACCEPTED_TYPES =
  "image/png, image/jpeg, image/jpg, image/webp, image/gif, image/avif";

class PortraitElement extends NagaraElement {
  static deps = ["portrait"];

  /** Inner nodes captured on first render; `null` until then. */
  #els = null;
  #handler = null;
  #cropAbort = null;
  /** True once a local file has been picked in this connection. */
  #editing = false;

  /** First render builds the markup; then wires the upload handler if writable. */
  connectedCallback() {
    super.connectedCallback();

    if (isWritable(this.fieldSchema, this.role, this.mode)) {
      this.#handler = initPortraitUpload(this, {
        onFileReady: (file) => this.#onFileReady(file),
        onCropChange: () => this.#patchCrop(),
      });
    } else {
      this.#els.fileInput.disabled = true;
      this.#els.dropZone.removeAttribute("tabindex");
    }
  }

  /** Tears down the handler (revoking any object URL) and cancels in-flight PATCHes. */
  disconnectedCallback() {
    this.#handler?.cleanup();
    this.#handler = null;
    this.#cropAbort?.abort();
    this.#cropAbort = null;
    this.#editing = false;
    super.disconnectedCallback();
  }

  /**
   * Staged portrait for the creation form: `{ file, crop, originalSize, … }`
   * or `null` when nothing has been picked.
   * @returns {object | null}
   */
  getPortraitData() {
    return this.#handler?.getPortraitData() ?? null;
  }

  render(character) {
    if (!this.#els) this.#build();
    if (this.#editing) return;

    const value = character?.portrait;
    const hasPortrait = Boolean(value?.path && value?.status === "uploaded");
    const { section, dropZone, placeholder, preview, img } = this.#els;

    if (hasPortrait) {
      section.dataset.portrait = "loaded";
    } else {
      delete section.dataset.portrait;
    }
    dropZone.setAttribute(
      "aria-label",
      hasPortrait ? "Portrait" : "Portrait upload area",
    );
    placeholder.hidden = hasPortrait;
    preview.hidden = !hasPortrait;

    if (hasPortrait) {
      if (img.getAttribute("src") !== value.path) img.src = value.path;
      const crop = value.crop;
      img.style.transform = crop
        ? `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${crop.rotation ?? 0}deg)`
        : "";
    } else {
      img.removeAttribute("src");
      img.style.transform = "";
    }
  }

  #build() {
    const section = document.createElement("section");
    section.id = "portrait";

    const dropZone = document.createElement("div");
    dropZone.setAttribute("role", "region");
    dropZone.setAttribute("tabindex", "-1");

    const placeholder = document.createElement("div");
    placeholder.id = "portrait-placeholder";

    const placeholderLabel = document.createElement("span");
    placeholderLabel.textContent = "Portrait";
    placeholder.appendChild(placeholderLabel);

    const plusIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    plusIcon.setAttribute("role", "img");
    plusIcon.setAttribute("aria-label", "Upload portrait");
    const plusUse = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "use",
    );
    plusUse.setAttribute("href", "/common/icons/icon-plus-2.svg");
    plusIcon.appendChild(plusUse);
    placeholder.appendChild(plusIcon);

    dropZone.appendChild(placeholder);

    const preview = document.createElement("div");
    preview.id = "portrait-preview";

    const img = document.createElement("img");
    img.alt = "Character portrait";
    preview.appendChild(img);
    dropZone.appendChild(preview);

    section.appendChild(dropZone);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "portrait-input";
    fileInput.accept = ACCEPTED_TYPES;
    fileInput.setAttribute("aria-label", "Upload portrait image");
    section.appendChild(fileInput);

    this.#els = { section, dropZone, placeholder, preview, img, fileInput };
    this.replaceChildren(section);
  }

  async #onFileReady(file) {
    this.#editing = true;
    if (this.mode === "create") return;

    try {
      const result = await api.uploadPortrait(this.character.id, file);
      if (!result.success) {
        console.error("[portrait] upload failed:", result.error);
        return;
      }
    } catch (err) {
      console.error("[portrait] upload error:", err);
      return;
    }

    await this.#patchCrop();
  }

  /** PATCH the current crop + source dimensions; supersedes any in-flight crop PATCH. */
  async #patchCrop() {
    if (this.mode === "create" || !this.#handler) return;

    const { crop, originalSize } = this.#handler.getPortraitData();
    const updates = [
      { field: "portrait.crop.x", value: crop.x },
      { field: "portrait.crop.y", value: crop.y },
      { field: "portrait.crop.scale", value: crop.scale },
      { field: "portrait.crop.rotation", value: crop.rotation ?? 0 },
      { field: "portrait.dimensions.width", value: originalSize.width },
      { field: "portrait.dimensions.height", value: originalSize.height },
    ];

    this.#cropAbort?.abort();
    const controller = new AbortController();
    this.#cropAbort = controller;

    try {
      const result = await api.patchCharacter(this.character.id, updates, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (result.success) {
        setCurrentCharacter(result.character);
      } else {
        console.error("[portrait] crop PATCH failed:", result.error);
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[portrait] crop PATCH error:", err);
    } finally {
      if (this.#cropAbort === controller) this.#cropAbort = null;
    }
  }
}

customElements.define("nagara-portrait", PortraitElement);

export const renderPortrait = componentFactory(PortraitElement);
