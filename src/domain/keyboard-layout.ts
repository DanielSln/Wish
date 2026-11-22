export function keyboardOverlap(top: number, height: number, keyboardTop?: number) {
  if (keyboardTop === undefined || ![top,height,keyboardTop].every(Number.isFinite) || height <= 0) return 0;
  return Math.max(0,Math.min(height,top+height-keyboardTop));
}
