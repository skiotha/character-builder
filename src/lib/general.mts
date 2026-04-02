import type { PortraitCrop, PortraitDimensions } from "#rpg-types";

export function scaleCropForContainer(
  originalCrop: PortraitCrop,
  fromSize: PortraitDimensions,
  toSize: PortraitDimensions,
): PortraitCrop {
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
