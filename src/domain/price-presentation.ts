import type { PriceEvidence } from '../services/import-prices.ts';
const valid = (price: number | null | undefined): price is number => typeof price === 'number' && Number.isSafeInteger(price) && price >= 0 && price <= 99999999999;
export function importPriceSummary(prices: PriceEvidence) {
  const current = valid(prices.current_cents) ? prices.current_cents : null;
  const conditional = prices.conditional && valid(prices.conditional.price_cents) ? prices.conditional : null;
  const candidates: { price_cents: number; label: string; conditional: boolean }[] = [];
  if (current !== null) candidates.push({ price_cents: current, label: 'Preço informado pela loja', conditional: false });
  if (conditional) candidates.push({ ...conditional, conditional: true });
  const coupons = prices.coupon_options?.length ? prices.coupon_options : prices.coupon ? [prices.coupon] : [];
  for (const coupon of coupons) if (!coupon.expired && valid(coupon.price_cents)) candidates.push({ price_cents: coupon.price_cents, label: `${coupon.label ?? 'Com cupom'} ${coupon.code} — ${coupon.conditions}`, conditional: true });
  // An explicit PIX condition remains visible even when its final amount equals the ordinary price.
  // Coupon ties still prefer an unconditional amount; equality alone never creates evidence.
  const lowest = candidates.reduce<(typeof candidates)[number] | null>((best, next) => !best || (next.price_cents < best.price_cents || next.price_cents === best.price_cents && /^À vista no PIX(?:$| —)/.test(next.label)) ? next : best, null);
  return { lowest, current, conditional, original: valid(prices.original_cents) && lowest && prices.original_cents > lowest.price_cents ? prices.original_cents : null };
}
