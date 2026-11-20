import type { PriceEvidence } from '../services/import-prices.ts';
const valid = (price: number | null | undefined): price is number => typeof price==='number' && Number.isSafeInteger(price) && price>=0 && price<=99999999999;
export function importPriceSummary(prices: PriceEvidence) {
  const current=valid(prices.current_cents)?prices.current_cents:null;
  const conditional=prices.conditional&&valid(prices.conditional.price_cents)?prices.conditional:null;
  const lowest=conditional&&(current===null||conditional.price_cents<current)
    ? {price_cents:conditional.price_cents,label:conditional.label,conditional:true}
    : current!==null?{price_cents:current,label:'preço comum informado',conditional:false}:null;
  return {lowest,current,conditional,original:valid(prices.original_cents)?prices.original_cents:null};
}
