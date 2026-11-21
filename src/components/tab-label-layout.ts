// Navigation geometry only. No font scaling is applied to the Text itself here.
export function labelExtraHeight(height:number,position:'below-icon'|'beside-icon'):number {
  if(!Number.isFinite(height)||height<0)return 0;
  // Existing 72dp bar already accommodates normal label metrics/platform font padding.
  return Math.max(0,height-(position==='below-icon'?16:24));
}
export function navigationBarHeight(extra:number,bottomInset:number):number {
  const growth=Number.isFinite(extra)?Math.max(0,extra):0;
  const inset=Number.isFinite(bottomInset)?Math.max(0,bottomInset):0;
  return 72+inset+Math.ceil(growth)+(growth>0?6:0);
}
