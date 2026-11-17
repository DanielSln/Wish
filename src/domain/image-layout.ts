export function fitProductImage(width: number, height: number, boxWidth: number, boxHeight: number, density: number) {
  if (![width,height,boxWidth,boxHeight,density].every(value => Number.isFinite(value) && value > 0)) return null;
  // A source pixel is never stretched over multiple device pixels.
  const scale = Math.min(1 / density, boxWidth / width, boxHeight / height);
  return { width: width * scale, height: height * scale };
}
