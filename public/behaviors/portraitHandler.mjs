/**
 * Portrait upload + pan-zoom behavior.
 *
 * Owns the interaction inside a rendered `section#portrait` (drop zone,
 * file input, preview image): drag/drop or file-pick an image, then pan
 * (pointer / touch) and wheel-zoom it inside the viewport. It never talks
 * to the network — the owning `<nagara-portrait>` element decides what a
 * finished file or a settled crop means for its mode (upload + PATCH on
 * the sheet, deferred to form submit during creation).
 *
 * The handler holds DOM references captured at init, so the element must
 * patch those nodes in place rather than replace them (ADR-017 §render-arg
 * names portrait as the in-place case).
 *
 * Crop values are pixel offsets relative to the drop zone's rendered size
 * at the time of the edit (`viewportSize`); the sheet and the creation form
 * therefore must render the zone at the same size for a stored crop to
 * reproduce.
 */

const CROP_SETTLE_MS = 300;

/**
 * Wire portrait upload + pan-zoom onto the `section#portrait` inside `host`.
 * @param {HTMLElement} host - Element containing `section#portrait`
 * @param {{
 *   onFileReady?: (file: File, data: object) => void,
 *   onCropChange?: (crop: { x: number, y: number, scale: number, rotation: number }, data: object) => void,
 * }} [callbacks] - `onFileReady` fires once a picked/dropped image is
 *   decoded and previewed; `onCropChange` fires when a pan or zoom gesture
 *   settles.
 * @returns {{ getPortraitData: () => object, removePortrait: (e?: Event) => void, cleanup: () => void }}
 */
export function initPortraitUpload(host, callbacks = {}) {
  const portrait = host.querySelector("section#portrait");
  const dropZone = portrait.querySelector(":scope > div");
  const fileInput = portrait.querySelector("input");
  const previewImg = portrait.querySelector("img");
  const previewContainer = portrait.querySelector("div#portrait-preview");
  const placeholder = portrait.querySelector("div#portrait-placeholder");

  let currentPortraitData = {
    file: null,
    url: null,
    crop: { x: 0.5, y: 0.5, scale: 1.0 },
    originalSize: { width: 0, height: 0 },
  };

  let disablePanZoom = null;
  let cropSettleTimer = null;

  // TODO(portrait-recrop): a click on an already-saved portrait opens the
  // file picker (replace); re-cropping the stored image without re-upload
  // is Chunk I step 4½ (.github/plans/phase6-chunkI-plan.md).
  const handleClick = () => !currentPortraitData.url && fileInput.click();

  const handleKeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  };

  dropZone.addEventListener("dragenter", handleDragEnter);
  dropZone.addEventListener("dragover", handleDragOver);
  dropZone.addEventListener("dragleave", handleDragLeave);
  dropZone.addEventListener("drop", handleDrop);
  dropZone.addEventListener("click", handleClick);
  dropZone.addEventListener("keydown", handleKeydown);
  fileInput.addEventListener("change", handleFileSelect);

  const cleanup = () => {
    clearTimeout(cropSettleTimer);
    if (currentPortraitData.url) {
      URL.revokeObjectURL(currentPortraitData.url);
    }
    if (disablePanZoom) {
      disablePanZoom();
      disablePanZoom = null;
    }
    dropZone.removeEventListener("dragenter", handleDragEnter);
    dropZone.removeEventListener("dragover", handleDragOver);
    dropZone.removeEventListener("dragleave", handleDragLeave);
    dropZone.removeEventListener("drop", handleDrop);
    dropZone.removeEventListener("click", handleClick);
    dropZone.removeEventListener("keydown", handleKeydown);
    fileInput.removeEventListener("change", handleFileSelect);
  };

  function handleDragEnter(e) {
    e.preventDefault();
    dropZone.classList.add("drag-active");
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e) {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove("drag-active");
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove("drag-active");

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((f) => f.type.startsWith("image/"));

    if (imageFile) {
      await processImageFile(imageFile);
    } else {
      showError("Drop an image file");
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      await processImageFile(file);
    }
  }

  async function processImageFile(file) {
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Select an image file");
      }

      if (file.size > 20 * 1024 * 1024) {
        throw new Error("Image is to big, try less than 20MB");
      }

      if (currentPortraitData.url) {
        URL.revokeObjectURL(currentPortraitData.url);
      }
      if (disablePanZoom) {
        disablePanZoom();
        disablePanZoom = null;
      }

      const url = URL.createObjectURL(file);

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const viewport = dropZone.getBoundingClientRect();
      const scaleX = viewport.width / img.width;
      const scaleY = viewport.height / img.height;
      const initialScale = Math.max(scaleX, scaleY);

      const initialX = (viewport.width - img.width * initialScale) * 0.5;
      const initialY = (viewport.height - img.height * initialScale) * 0.5;

      currentPortraitData = {
        file,
        url,
        crop: { x: initialX, y: initialY, scale: initialScale, rotation: 0 },
        originalSize: { width: img.width, height: img.height },
        viewportSize: { width: viewport.width, height: viewport.height },
      };

      updatePreview();
      disablePanZoom = enablePanZoom();
      callbacks.onFileReady?.(file, getPortraitData());
    } catch (error) {
      console.error("Image processing error:", error);
      showError(error.message);
    }
  }

  function scheduleCropChange() {
    clearTimeout(cropSettleTimer);
    cropSettleTimer = setTimeout(() => {
      callbacks.onCropChange?.(
        { ...currentPortraitData.crop },
        getPortraitData(),
      );
    }, CROP_SETTLE_MS);
  }

  function enablePanZoom() {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    dropZone.addEventListener("mousedown", startPan);
    dropZone.addEventListener("mousemove", pan);
    dropZone.addEventListener("mouseup", stopPan);
    dropZone.addEventListener("mouseleave", stopPan);
    dropZone.addEventListener("wheel", handleZoom, { passive: false });

    dropZone.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    dropZone.addEventListener("touchmove", handleTouchMove, { passive: false });
    dropZone.addEventListener("touchend", stopPan);

    function startPan(e) {
      isPanning = true;
      const point = getEventPoint(e);
      lastX = point.x;
      lastY = point.y;
      dropZone.style.cursor = "grabbing";
    }

    function pan(e) {
      if (!isPanning) return;

      const point = getEventPoint(e);
      const dx = point.x - lastX;
      const dy = point.y - lastY;

      currentPortraitData.crop.x += dx;
      currentPortraitData.crop.y += dy;

      constrainImageToViewport();

      lastX = point.x;
      lastY = point.y;

      updatePreview();
    }

    function stopPan() {
      if (!isPanning) return;
      isPanning = false;
      dropZone.style.cursor = "grab";
      scheduleCropChange();
    }

    function handleZoom(e) {
      e.preventDefault();

      const zoomIntensity = 0.001;
      const wheelDelta = e.deltaY > 0 ? -1 : 1;
      const scaleChange = 1 + wheelDelta * zoomIntensity * Math.abs(e.deltaY);

      const rect = dropZone.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldScale = currentPortraitData.crop.scale;
      const newScale = Math.min(Math.max(oldScale * scaleChange, 0.25), 5);

      const scaleRatio = newScale / oldScale;
      currentPortraitData.crop.x =
        mouseX - (mouseX - currentPortraitData.crop.x) * scaleRatio;
      currentPortraitData.crop.y =
        mouseY - (mouseY - currentPortraitData.crop.y) * scaleRatio;
      currentPortraitData.crop.scale = newScale;

      constrainImageToViewport();
      updatePreview();
      scheduleCropChange();
    }

    function getEventPoint(e) {
      if (e.type?.includes("touch")) {
        return {
          x: e.touches[0].clientX - dropZone.getBoundingClientRect().left,
          y: e.touches[0].clientY - dropZone.getBoundingClientRect().top,
        };
      }

      return {
        x: e.clientX - dropZone.getBoundingClientRect().left,
        y: e.clientY - dropZone.getBoundingClientRect().top,
      };
    }

    function handleTouchStart(e) {
      e.preventDefault();
      startPan(e.touches[0]);
    }

    function handleTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        pan(e.touches[0]);
      }
    }

    function constrainImageToViewport() {
      const { crop, originalSize, viewportSize } = currentPortraitData;
      const displayWidth = originalSize.width * crop.scale;
      const displayHeight = originalSize.height * crop.scale;

      const maxX = 0;
      const minX = viewportSize.width - displayWidth;
      const maxY = 0;
      const minY = viewportSize.height - displayHeight;

      crop.x = Math.min(Math.max(crop.x, minX), maxX);
      crop.y = Math.min(Math.max(crop.y, minY), maxY);

      if (displayWidth < viewportSize.width) {
        crop.x = (viewportSize.width - displayWidth) * 0.5;
      }
      if (displayHeight < viewportSize.height) {
        crop.y = (viewportSize.height - displayHeight) * 0.5;
      }
    }

    constrainImageToViewport();

    return function disablePanZoom() {
      dropZone.removeEventListener("mousedown", startPan);
      dropZone.removeEventListener("mousemove", pan);
      dropZone.removeEventListener("mouseup", stopPan);
      dropZone.removeEventListener("mouseleave", stopPan);
      dropZone.removeEventListener("wheel", handleZoom);
      dropZone.removeEventListener("touchstart", handleTouchStart);
      dropZone.removeEventListener("touchmove", handleTouchMove);
      dropZone.removeEventListener("touchend", stopPan);
      dropZone.style.cursor = "";
    };
  }

  function updatePreview() {
    placeholder.hidden = true;
    previewContainer.hidden = false;

    previewImg.src = currentPortraitData.url;
    previewImg.style.transform = `
        translate(${currentPortraitData.crop.x}px, ${currentPortraitData.crop.y}px)
        scale(${currentPortraitData.crop.scale})
        rotate(${currentPortraitData.crop.rotation}deg)
    `;
  }

  function removePortrait(e) {
    if (currentPortraitData.url) {
      URL.revokeObjectURL(currentPortraitData.url);
    }
    if (disablePanZoom) {
      disablePanZoom();
      disablePanZoom = null;
    }

    e?.stopPropagation();

    currentPortraitData = {
      file: null,
      url: null,
      crop: { x: 0.5, y: 0.5, scale: 1.0 },
      originalSize: { width: 0, height: 0 },
    };

    placeholder.hidden = false;
    previewContainer.hidden = true;
    fileInput.value = "";
  }

  function showError(message) {
    console.error("Portrait error:", message);
  }

  function getPortraitData() {
    return { ...currentPortraitData, crop: { ...currentPortraitData.crop } };
  }

  return {
    getPortraitData,
    removePortrait,
    cleanup,
  };
}
