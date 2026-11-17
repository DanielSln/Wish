import { parsePrice, money } from '../domain/product.ts';
export type CouponPreview = { code: string; percent: number | null; amount_cents: number | null; price_cents: number | null; conditions: string; expired: boolean };
export type PriceEvidence = { current_cents: number | null; original_cents: number | null; conditional: { price_cents: number; label: string } | null; coupon: CouponPreview | null; warnings: string[]; notes: string };
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const clean = (v: unknown, max = 500) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const schemaName = (v: unknown) => typeof v === 'string' ? v.replace(/^https?:\/\/schema.org\//, '') : '';
const hasType = (v: unknown, type: string): boolean => (Array.isArray(v) ? v : [v]).some(t => schemaName(t) === type);
function cents(value: unknown, currency: unknown): number | null {
  if (currency !== 'BRL' || !['string', 'number'].includes(typeof value)) return null;
  try { return parsePrice(String(value)); } catch { return null; }
}
function date(value: unknown, end: boolean): number | null {
  if (typeof value !== 'string') return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!day && !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const calendar = Date.parse(value.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  const time = Date.parse(day ? value + (end ? 'T23:59:59.999Z' : 'T00:00:00.000Z') : value);
  return Number.isFinite(time) ? time : null;
}
function timely(offer: Row, now: number): boolean {
  for (const key of ['priceValidUntil', 'validThrough']) {
    if (!(key in offer)) continue;
    const end = date(offer[key], true); if (end === null || end < now) return false;
  }
  if ('validFrom' in offer) { const start = date(offer.validFrom, false); if (start === null || start > now) return false; }
  return true;
}
const conditionKeys = ['eligibleTransactionVolume', 'eligibleQuantity', 'eligibleCustomerType', 'eligibleRegion', 'validForMemberTier', 'appliesToPaymentMethod'];
function conditions(spec: Row): string {
  const parts = [clean(spec.description)];
  const volume = row(spec.eligibleTransactionVolume);
  const minimum = cents(volume.minPrice, volume.priceCurrency);
  if (minimum !== null) parts.push(`Compra mínima informada: ${money(minimum)}.`);
  if (conditionKeys.some(k => spec[k] != null)) parts.push('Existem requisitos de compra, pagamento, região ou elegibilidade; confira na loja.');
  return parts.filter(Boolean).join(' ');
}
function conditional(spec: Row): boolean {
  return spec.priceComponentType != null || spec.referenceQuantity != null || conditionKeys.some(k => spec[k] != null) || !!clean(spec.description) || /\b(pix|boleto|cartão|cartao|membro|assinante|app|cupom)\b/i.test(clean(spec.name));
}
function unique(values: (number | null)[]): number | null {
  const prices = [...new Set(values.filter((v): v is number => v !== null))];
  return prices.length === 1 ? prices[0] : null;
}
export function extractPrices(item: Row, meta: Record<string, string>, source: string, now: number, nextData: unknown, visibleText: string): PriceEvidence {
  const result: PriceEvidence = { current_cents: null, original_cents: null, conditional: null, coupon: null, warnings: [], notes: '' };
  const offers = Array.isArray(item.offers) ? item.offers : item.offers ? [item.offers] : [];
  const offer = offers.length === 1 ? row(offers[0]) : {};
  const expired = offers.length === 1 && !timely(offer, now);
  const ambiguous = offers.length > 1 || hasType(offer['@type'], 'AggregateOffer');
  if (expired) result.warnings.push('A validade do preço está vencida, futura ou não pôde ser confirmada; nenhum valor foi preenchido.');
  const rawSpecs = offer.priceSpecification ? (Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification]) : [];
  const specs = rawSpecs.map(row);
  const couponSpecs = specs.filter(s => /^Com (?:o )?cupom [A-Z0-9_-]{3,32}$/i.test(clean(s.name)));
  if (couponSpecs.length === 1) {
    const s = couponSpecs[0]; const code = clean(s.name).split(' ').at(-1)!;
    const unavailable = expired || !timely(s, now);
    result.coupon = { code, percent: null, amount_cents: null, price_cents: unavailable || s.priceComponentType != null || s.referenceQuantity != null || (s.priceType != null && schemaName(s.priceType) !== 'SalePrice') ? null : cents(s.price, s.priceCurrency ?? offer.priceCurrency), expired: unavailable, conditions: [conditions(offer), conditions(s), 'Valor anunciado com cupom; aplicação, disponibilidade e elegibilidade não verificadas.'].filter(Boolean).join(' ') };
  } else if (couponSpecs.length > 1) result.warnings.push('Há vários cupons; nenhum foi escolhido automaticamente.');
  if (!ambiguous && !expired) {
    const ordinary = specs.filter(s => !couponSpecs.includes(s));
    const saleSpecs = ordinary.filter(s => schemaName(s.priceType) === 'SalePrice');
    const sales = saleSpecs.filter(s => timely(s, now) && !conditional(s) && !conditional(offer));
    const original = ordinary.filter(s => ['ListPrice', 'StrikethroughPrice'].includes(schemaName(s.priceType)) && timely(s, now) && !conditional(s) && !conditional(offer));
    result.original_cents = unique(original.map(s => cents(s.price, s.priceCurrency ?? offer.priceCurrency)));
    const declaredBase = !conditional(offer) ? cents(offer.price, offer.priceCurrency) : null;
    const restrictedBase = specs.some(s => cents(s.price, s.priceCurrency ?? offer.priceCurrency) === declaredBase && (couponSpecs.includes(s) || conditional(s) || !timely(s, now)));
    const plain = ordinary.filter(s => (hasType(s['@type'], 'PriceSpecification') || hasType(s['@type'], 'UnitPriceSpecification')) && s.priceType == null && s.priceComponentType == null && s.name == null && s.referenceQuantity == null && timely(s, now) && !conditional(s) && !conditional(offer));
    const base = restrictedBase ? null : declaredBase ?? unique(plain.map(s => cents(s.price, s.priceCurrency ?? offer.priceCurrency)));
    const sale = unique(sales.map(s => cents(s.price, s.priceCurrency ?? offer.priceCurrency)));
    if (sales.length && sale === null) result.warnings.push('Preços promocionais conflitantes; confirme o valor na loja.');
    const onlyReference = ordinary.some(s => ['ListPrice', 'StrikethroughPrice', 'MSRP'].includes(schemaName(s.priceType)) && cents(s.price, s.priceCurrency ?? offer.priceCurrency) === base);
    // A known list/reference price is never promoted to a current price.
    result.current_cents = sales.length ? sale : onlyReference ? null : base;
    if (!offers.length) result.current_cents = cents(meta['product:price:amount'], meta['product:price:currency']);
    if (result.original_cents === null) result.original_cents = cents(meta['product:original_price:amount'], meta['product:original_price:currency']);
    if (!offers.length && result.current_cents !== null && result.current_cents === result.original_cents) result.current_cents = null;
    const ogSale = cents(meta['product:sale_price:amount'], meta['product:sale_price:currency']);
    if (ogSale !== null && (!offers.length || offer.priceCurrency === 'BRL') && !conditional(offer) && !saleSpecs.length) {
      const validity: Row = {};
      if (meta['product:sale_price_dates:start']) validity.validFrom = meta['product:sale_price_dates:start'];
      if (meta['product:sale_price_dates:end']) validity.validThrough = meta['product:sale_price_dates:end'];
      if (timely(validity, now)) result.current_cents = ogSale;
      else result.warnings.push('A promoção dos metadados está fora da validade; confirme o preço.');
    }
    if (conditional(offer) || saleSpecs.some(conditional)) result.warnings.push('Há preço condicionado nos metadados. Nenhum desconto condicionado foi aplicado automaticamente.');
  }
  // Store adapter: only public JSON embedded in the chosen product page, never an API call.
  // Fields were observed on KaBuM's page. Match URL, JSON-LD SKU and embedded ID before use.
  const url = new URL(source); const match = /^\/produto\/(\d+)(?:\/|$)/.exec(url.pathname);
  const embedded = row(row(row(nextData).props).pageProps).product;
  if (['kabum.com.br', 'www.kabum.com.br'].includes(url.hostname) && match && embedded) {
    const p = row(embedded); const prices = row(p.prices); const campaign = row(p.offer);
    const sameProduct = Number.isSafeInteger(p.id) && String(p.id) === match[1] && String(item.sku ?? match[1]) === match[1];
    const datesOk = ['startDate', 'endDate'].every(k => !(k in campaign) || (typeof campaign[k] === 'number' && Number.isFinite(campaign[k]) && (k === 'startDate' ? campaign[k] * 1000 <= now : campaign[k] * 1000 >= now)));
    if (sameProduct && offer.priceCurrency === 'BRL' && !ambiguous && !expired && datesOk && p.available === true && p.sellerId === 0 && p.sellerName === 'KaBuM!' && (p.marketplace === false || row(p.marketplace).sellerName === 'KaBuM!' && row(p.marketplace).linkSellerPage === '') && campaign.login !== true && row(p.prime).isLoggedUserExclusive !== true) {
      const regular = cents(prices.price, 'BRL'); const pix = cents(prices.priceWithDiscount, 'BRL');
      if (regular !== null && cents(p.price, 'BRL') === regular) {
        result.current_cents = regular;
        result.original_cents = cents(prices.oldPrice, 'BRL');
        if (pix !== null && pix < regular && /à vista no PIX/i.test(visibleText)) result.conditional = { price_cents: pix, label: 'À vista no PIX' };
      }
      const banner = /Use o cupom ([A-Z0-9_-]{3,32}) e ganhe (?:(\d+(?:[.,]\d{1,2})?)% OFF|R\$\s*(\d+(?:[.,]\d{1,2})?) de desconto) neste item[^.]*\.?[^.]*\.?/i.exec(visibleText);
      if (banner) {
        const percent = banner[2] ? Number(banner[2].replace(',', '.')) : null;
        if (percent === null || percent > 0 && percent <= 100) result.coupon = { code: banner[1], percent, amount_cents: banner[3] ? cents(banner[3], 'BRL') : null, price_cents: null, expired: false, conditions: clean(banner[0]) + ' Não foi informado preço final verificável; disponibilidade e elegibilidade não confirmadas.' };
      }
    } else {
      result.current_cents = null; result.original_cents = null; result.conditional = null;
      result.warnings.push('Os dados públicos da KaBuM não confirmam uma oferta vigente e sem restrições para este produto. Revise o preço manualmente.');
    }
  }
  if (ambiguous) { result.coupon = null; result.original_cents = null; }
  if (result.coupon) result.warnings.push(result.coupon.expired ? 'O cupom está vencido ou sem validade confirmada; não foi aplicado.' : 'Cupom não aplicado automaticamente. Confira as condições na loja; você pode editar o preço antes de salvar.');
  if (result.original_cents !== null && result.current_cents !== null && result.original_cents <= result.current_cents) result.original_cents = null;
  const notes: string[] = [];
  if (result.original_cents !== null) notes.push(`Preço anterior informado pela loja: ${money(result.original_cents)}.`);
  if (result.conditional) notes.push(`${result.conditional.label}: ${money(result.conditional.price_cents)} (condicionado, não aplicado automaticamente).`);
  if (result.coupon) {
    const c = result.coupon;
    notes.push(`Cupom anunciado: ${c.code}${c.percent !== null ? ` (${c.percent}%)` : c.amount_cents !== null ? ` (${money(c.amount_cents)} de desconto)` : ''}.${c.price_cents !== null ? ` Preço anunciado com cupom: ${money(c.price_cents)}.` : ''} ${c.conditions}${c.expired ? ' Validade não confirmada ou vencida.' : ''}`);
  }
  result.notes = notes.length ? ['Informações da página na importação; confirme valores e condições atuais na loja.', ...notes].join('\n') : '';
  return result;
}
