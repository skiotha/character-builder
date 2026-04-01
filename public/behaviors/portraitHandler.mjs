export function initPortraitUpload(container) {
  const portrait = container.querySelector("section#portrait");
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

  dropZone.addEventListener("dragenter", handleDragEnter);
  dropZone.addEventListener("dragover", handleDragOver);
  dropZone.addEventListener("dragleave", handleDragLeave);
  dropZone.addEventListener("drop", handleDrop);

  dropZone.addEventListener(
    "click",
    () => !currentPortraitData.url && fileInput.click(),
  );

  fileInput.addEventListener("change", handleFileSelect);

  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  let disablePanZoom = null;

  const cleanup = () => {
    if (currentPortraitData.url) {
      URL.revokeObjectURL(currentPortraitData.url);
    }
    if (disablePanZoom) {
      disablePanZoom();
    }
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
    } catch (error) {
      console.error("Image processing error:", error);
      showError(error.message);
    }
  }

  function enablePanZoom() {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;
    let scale = currentPortraitData.crop.scale;

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

    const eventHandlers = {
      startPan,
      pan,
      stopPan,
      handleZoom,
      handleTouchStart,
      handleTouchMove,
    };

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
      isPanning = false;
      dropZone.style.cursor = "grab";
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

    cleanup.eventHandlers = eventHandlers;

    return function disablePanZoom() {
      dropZone.removeEventListener("mousedown", startPan);
      dropZone.removeEventListener("mousemove", pan);
      dropZone.removeEventListener("mouseup", stopPan);
      dropZone.removeEventListener("mouseleave", stopPan);
      dropZone.removeEventListener("wheel", handleZoom);
      dropZone.removeEventListener("touchstart", handleTouchStart);
      dropZone.removeEventListener("touchmove", handleTouchMove);
      dropZone.removeEventListener("touchend", stopPan);
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

    // if (!previewContainer.querySelector(".portrait-controls")) {
    //   const controls = document.createElement("div");
    //   controls.id = "portrait-controls";
    //   controls.innerHTML = `
    //     <button type="button"
    //       data-action="fit-portrait"
    //       aria-label="Fit image to viewport"
    //       tabindex="-1">
    //         <span>O</span>
    //     </button>
    //     <button type="button"
    //       data-action="remove-portrait"
    //       aria-label="Remove portrait"
    //       tabindex="-1">
    //         <span>X</span>
    //     </button>
    //     `;
    //   previewContainer.appendChild(controls);

    //   controls
    //     .querySelector("[data-action='fit-portrait']")
    //     .addEventListener("click", fitImageToViewport);
    //   controls
    //     .querySelector("[data-action='remove-portrait']")
    //     .addEventListener("click", removePortrait);
    // }
  }

  function fitImageToViewport() {
    const viewport = dropZone.getBoundingClientRect();
    const { originalSize } = currentPortraitData;

    const scaleX = viewport.width / originalSize.width;
    const scaleY = viewport.height / originalSize.height;
    const newScale = Math.max(scaleX, scaleY);

    const newX = (viewport.width - originalSize.width * newScale) * 0.5;
    const newY = (viewport.height - originalSize.height * newScale) * 0.5;

    currentPortraitData.crop = { x: newX, y: newY, scale: newScale };
    updatePreview();
  }

  function removePortrait(e) {
    if (currentPortraitData.url) {
      URL.revokeObjectURL(currentPortraitData.url);
    }

    e.stopPropagation();

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

  return {
    getPortraitData: () => ({ ...currentPortraitData }),
    removePortrait,
    cleanup,
  };
}
