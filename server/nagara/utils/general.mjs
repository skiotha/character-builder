/**
 * Transforming portrait crop data from stored portrait-sized to new dashboard-preview size
 * @param {*} originalCrop
 * @param {Number} fromSize
 * @param {Number} toSize
 */
export function scaleCropForContainer(originalCrop, fromSize, toSize) {
  const widthRatio = toSize.width / fromSize.width;
  const heightRatio = toSize.height / fromSize.height;

  const scaledX = originalCrop.x * widthRatio;
  const scaledY = originalCrop.y * heightRatio;

  const scaledScale = originalCrop.scale * Math.min(widthRatio, heightRatio);

  return {
    x: scaledX,
    y: scaledY,
    scale: scaledScale,
    rotation: originalCrop.rotation,
  };
}
