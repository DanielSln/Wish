import { parsePrice, money } from '../domain/product.ts';
export type CouponPreview = { code: string; percent: number | null; amount_cents: number | null; price_cents: number | null; conditions: string; expired: boolean; label?: string };
export type PriceEvidence = { current_cents: number | null; original_cents: number | null; conditional: { price_cents: number; label: string } | null; coupon: CouponPreview | null; coupon_options?: CouponPreview[]; warnings: string[]; notes: string };
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
  const parts = [clean(spec.description, 10000)];
  for (const key of conditionKeys) if (spec[key] != null) parts.push(key + ': ' + JSON.stringify(spec[key]));
  const volume = row(spec.eligibleTransactionVolume);
  const minimum = cents(volume.minPrice, volume.priceCurrency);
  if (minimum !== null) parts.push(`Compra mínima informada: ${money(minimum)}.`);
  if (conditionKeys.some(k => spec[k] != null)) parts.push('Existem requisitos de compra, pagamento, região ou elegibilidade; confira na loja.');
  return parts.filter(Boolean).join(' ');
}
function conditional(spec: Row): boolean {
  return spec.priceComponentType != null || spec.referenceQuantity != null || conditionKeys.some(k => spec[k] != null) || !!clean(spec.description) || /\b(pix|boleto|cartão|cartao|membro|assinante|app|cupom|parcela|parcelas|frete|cashback|referência|referencia|unidade)\b/i.test(clean(spec.name));
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
  const offered = row(offer.itemOffered);
  const differentVariant = ['sku', 'mpn', 'gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14'].some(key => item[key] != null && offered[key] != null && String(item[key]) !== String(offered[key]));
  const unavailable = ['OutOfStock', 'Discontinued'].includes(schemaName(offer.availability));
  const ambiguous = offers.length > 1 || hasType(offer['@type'], 'AggregateOffer') || differentVariant || unavailable;
  if (differentVariant || unavailable) result.warnings.push('Oferta indisponível ou de outra variante; preço não confirmado.');
  if (expired) result.warnings.push('A validade do preço está vencida, futura ou não pôde ser confirmada; nenhum valor foi preenchido.');
  const rawSpecs = offer.priceSpecification ? (Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification]) : [];
  const specs = rawSpecs.map(row);
  // Only explicit, total product prices with an identifiable payment/coupon condition.
  // Never infer a combined discount from separate percentages or arbitrary page numbers.
  const couponPattern = /^(?:(?:À vista no )?PIX(?:\s*\+\s*| com (?:o )?)cupom |Com (?:o )?cupom )[A-Z0-9_-]{3,32}(?: no PIX)?$/i;
  const couponSpecs = specs.filter(s => couponPattern.test(clean(s.name)));
  const pixSpecs = specs.filter(s => /^(?:À vista no )?PIX$/i.test(clean(s.name)));
  const explicitTotal = (s: Row) => !/\b(parcela|parcelas|frete|cashback|referência|referencia|por unidade)\b/i.test([clean(s.name), clean(s.description)].join(' ')) && timely(s, now) && s.priceComponentType == null && s.referenceQuantity == null && (s.priceType == null || schemaName(s.priceType) === 'SalePrice');
  if (!ambiguous && !expired && !conditional(offer)) {
    const pix = unique(pixSpecs.filter(explicitTotal).map(s => cents(s.price, s.priceCurrency ?? offer.priceCurrency)));
    if (pix !== null) result.conditional = { price_cents: pix, label: ['À vista no PIX', ...pixSpecs.filter(explicitTotal).map(conditions)].filter(Boolean).join(' — ') };
    else if (pixSpecs.length) result.warnings.push('Preço PIX ausente, inválido ou conflitante; confirme na loja.');
  }
  const couponOptions: CouponPreview[] = couponSpecs.map(s => {
    const name = clean(s.name); const code = /cupom ([A-Z0-9_-]{3,32})/i.exec(name)![1];
    const unavailable = expired || !timely(s, now);
    return { code, percent: null, amount_cents: null,
      price_cents: ambiguous || unavailable || conditional(offer) || !explicitTotal(s) ? null : cents(s.price, s.priceCurrency ?? offer.priceCurrency),
      label: /\bpix\b/i.test(name) ? 'À vista no PIX + cupom' : 'Com cupom', expired: unavailable,
      conditions: [conditions(offer), conditions(s), 'Valor anunciado com cupom; aplicação, disponibilidade e elegibilidade não verificadas.'].filter(Boolean).join(' ') };
  });
  // Different explicit conditions are alternatives; conflicting values for the same
  // code/payment/requirements are not resolved by simply taking the lowest number.
  const couponKey = (coupon: CouponPreview) => [coupon.code.toUpperCase(), coupon.label, coupon.conditions].join('|');
  const valuesByCondition = new Map<string, Set<number>>();
  for (const coupon of couponOptions) if (coupon.price_cents !== null) {
    const key = couponKey(coupon);
    const values = valuesByCondition.get(key) ?? new Set<number>();
    values.add(coupon.price_cents); valuesByCondition.set(key, values);
  }
  const conflicts = new Set([...valuesByCondition].filter(([, values]) => values.size > 1).map(([key]) => key));
  result.coupon_options = couponOptions.map(coupon => conflicts.has(couponKey(coupon)) ? { ...coupon, price_cents: null } : coupon);
  if (conflicts.size) result.warnings.push('Preços conflitantes para o mesmo cupom e condição; confirme manualmente.');
  result.coupon = result.coupon_options.reduce<CouponPreview | null>((best, coupon) => !best || coupon.price_cents !== null && (best.price_cents === null || coupon.price_cents < best.price_cents) ? coupon : best, null);
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
    result.current_cents = sales.length ? sale === null ? null : base !== null && !onlyReference ? Math.min(base, sale) : sale : onlyReference ? null : base;
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
    if (conditional(offer) || saleSpecs.some(conditional)) result.warnings.push('Confira os requisitos dos preços condicionados anunciados pela loja.');
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
        if (pix !== null && pix < regular && /à vista no PIX/i.test(visibleText)) {
          if (result.conditional && result.conditional.price_cents !== pix || pixSpecs.length && !result.conditional) {
            result.conditional = null;
            result.warnings.push('Fontes de preço PIX conflitantes; confirme o valor manualmente.');
          } else if (!result.conditional) result.conditional = { price_cents: pix, label: 'À vista no PIX' };
        }
      }
      const banner = /Use o cupom ([A-Z0-9_-]{3,32}) e ganhe (?:(\d+(?:[.,]\d{1,2})?)% OFF|R\$\s*(\d+(?:[.,]\d{1,2})?) de desconto) neste item[^.]*\.?[^.]*\.?/i.exec(visibleText);
      if (banner) {
        const percent = banner[2] ? Number(banner[2].replace(',', '.')) : null;
        if (percent === null || percent > 0 && percent <= 100) {
          const existing = result.coupon;
          if (existing && existing.code.toUpperCase() === banner[1].toUpperCase()) {
            // A percentage banner supplements evidence; it must not erase an explicit final price or its validity.
            result.coupon = { ...existing, percent, amount_cents: banner[3] ? cents(banner[3], 'BRL') : existing.amount_cents, conditions: existing.conditions + ' ' + clean(banner[0]) };
          } else if (!existing && couponSpecs.length === 0) {
            result.coupon = { code: banner[1], percent, amount_cents: banner[3] ? cents(banner[3], 'BRL') : null, price_cents: null, expired: false, conditions: clean(banner[0]) + ' Preço final com cupom não confirmado.' };
          } else {
            result.warnings.push('Outro cupom anunciado: ' + clean(banner[0]) + ' Não foi combinado com o preço identificado.');
          }
        }
      }
    } else {
      result.current_cents = null; result.original_cents = null; result.conditional = null; if (result.coupon) result.coupon = { ...result.coupon, price_cents: null }; result.coupon_options = result.coupon_options?.map(coupon => ({ ...coupon, price_cents: null }));
      result.warnings.push('Os dados públicos da KaBuM não confirmam uma oferta vigente e sem restrições para este produto. Revise o preço manualmente.');
    }
  }
  if (ambiguous) { result.coupon = null; result.coupon_options = []; result.original_cents = null; }
  if (result.coupon) result.warnings.push(result.coupon.expired ? 'O cupom está vencido ou sem validade confirmada; não foi aplicado.' : result.coupon.price_cents === null ? 'Cupom anunciado sem preço final confirmado.' : 'Preço com cupom anunciado pela loja; elegibilidade não verificada.');
  if (result.original_cents !== null && result.current_cents !== null && result.original_cents <= result.current_cents) result.original_cents = null;
  const notes: string[] = [];
  if (result.original_cents !== null) notes.push(`Preço anterior informado pela loja: ${money(result.original_cents)}.`);
  if (result.conditional) notes.push(`${result.conditional.label}: ${money(result.conditional.price_cents)} (valor condicionado anunciado pela loja).`);
  const selectedCoupon = result.coupon;
  const couponEvidence = result.coupon_options?.length ? result.coupon_options.map(coupon => selectedCoupon && selectedCoupon.code.toUpperCase() === coupon.code.toUpperCase() && selectedCoupon.label === coupon.label ? { ...coupon, percent: selectedCoupon.percent, amount_cents: selectedCoupon.amount_cents, conditions: selectedCoupon.conditions } : coupon) : selectedCoupon ? [selectedCoupon] : [];
  for (const c of couponEvidence) {
    if (c.label) notes.push(`Condição do cupom: ${c.label}.`);
    notes.push(`Cupom anunciado: ${c.code}${c.percent !== null ? ` (${c.percent}%)` : c.amount_cents !== null ? ` (${money(c.amount_cents)} de desconto)` : ''}.${c.price_cents !== null ? ` Preço anunciado com cupom: ${money(c.price_cents)}.` : ''} ${c.conditions}${c.expired ? ' Validade não confirmada ou vencida.' : ''}`);
  }
  result.notes = notes.length ? ['Informações da página na importação; confirme valores e condições atuais na loja.', ...notes].join('\n') : '';
  return result;
}
