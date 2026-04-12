/**
 * Scale a portrait crop from one container size to another.
 * Duplicated from src/lib/general.mts for client-side use.
 *
 * @param {{ x: number, y: number, scale: number, rotation: number }} originalCrop
 * @param {{ width: number, height: number }} fromSize
 * @param {{ width: number, height: number }} toSize
 * @returns {{ x: number, y: number, scale: number, rotation: number }}
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
