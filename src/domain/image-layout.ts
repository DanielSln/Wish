export function fitProductImage(width: number, height: number, boxWidth: number, boxHeight: number, density: number) {
  if (![width,height,boxWidth,boxHeight,density].every(value => Number.isFinite(value) && value > 0)) return null;
  // A source pixel is never stretched over multiple device pixels.
  const scale = Math.min(1 / density, boxWidth / width, boxHeight / height);
  return { width: width * scale, height: height * scale };
}

export function productImagePresentation(width:number,height:number,boxWidth:number,boxHeight:number,density:number,large=false){
  const fit=fitProductImage(width,height,boxWidth,boxHeight,density);if(!fit)return null;
  const coverScale=Math.max(boxWidth/width,boxHeight/height);
  const retainedArea=boxWidth*boxHeight/(width*coverScale*height*coverScale);
  // Fill compact photos when enough physical pixels exist; preserve tiny/panoramic products.
  if(coverScale<=1/density&&retainedArea>=(large?0.9:0.6))return {width:boxWidth,height:boxHeight,resizeMode:'cover' as const};
  return {...fit,resizeMode:'contain' as const};
}

// expo-image supplies decoded source dimensions consistently on native and web.
export function imageLoadDimensions(event: unknown): { width: number; height: number } | null {
  const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const payload = object(event);
  const source = object(payload.source ?? object(payload.nativeEvent).source);
  const { width, height } = source;
  return typeof width === 'number' && typeof height === 'number' && Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width * height <= 20000000 ? { width, height } : null;
}
