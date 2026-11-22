type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
export function urlIdentity(value: string): Map<string, string> {
  const found = new Map<string,string>(); let url: URL;
  try { url = new URL(value); } catch { return found; }
  const path = url.pathname;
  const asin = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i.exec(path)?.[1];
  const kabum = /\/produto\/(\d+)(?:\/|$)/.exec(path)?.[1];
  const ml = /(?:^|\/)(MLB[U-]?\d+)/i.exec(path)?.[1]?.replace('-', '');
  if (asin) found.set('product', asin.toUpperCase());
  if (kabum) found.set('product', kabum);
  if (ml) found.set(ml.startsWith('MLBU') ? 'product' : 'item_id', ml.toUpperCase());
  for (const key of ['sku','variant','variantId','seller_id','item_id']) if (url.searchParams.get(key)) found.set(key, url.searchParams.get(key)!);
  const listing = /(?:^|[|,])item_id:(MLB\d+)/i.exec(url.searchParams.get('pdp_filters') ?? '')?.[1];
  if (listing) found.set('item_id', listing.toUpperCase());
  return found;
}
export function conflictingUrl(a: string, b: string): boolean {
  const left = urlIdentity(a); const right = urlIdentity(b);
  return [...left].some(([key,value]) => right.has(key) && right.get(key) !== value);
}
export function selectMetadataProduct(products: Row[], source: string): Row | null {
  const identity = urlIdentity(source);
  const candidateUrls = (p: Row) => [p.url, p['@id']].filter((v): v is string => typeof v === 'string').map(v => { try { return new URL(v,source).href; } catch { return ''; } }).filter(Boolean);
  const compatible = (p: Row) => !candidateUrls(p).some(url => conflictingUrl(source,url));
  if (products.length === 1) {
    if (!compatible(products[0])) throw new Error('O produto ou a variante não corresponde ao link. Complete os dados manualmente.');
    const offers = products[0].offers; const offer = row(Array.isArray(offers) ? offers.length === 1 ? offers[0] : null : offers);
    if (typeof offer.url === 'string') {
      try { if (conflictingUrl(source, new URL(offer.url,source).href)) return { ...products[0], offers: { '@type': 'AggregateOffer' } }; } catch { return { ...products[0], offers: { '@type': 'AggregateOffer' } }; }
    }
    return products[0];
  }
  const variantKeys = [...identity.keys()].filter(key => key !== 'product');
  const matches = products.filter(p => compatible(p) && (candidateUrls(p).some(url => {
    const other = urlIdentity(url);
    if (variantKeys.some(key => other.get(key) !== identity.get(key))) return false;
    if (identity.size && [...identity].some(([key,value]) => other.get(key) === value)) return true;
    const a = new URL(url); const b = new URL(source); a.hash = ''; b.hash = '';
    return a.href === b.href;
  }) || !variantKeys.length && identity.has('product') && String(p.sku ?? '').toUpperCase() === identity.get('product')));
  return matches.length === 1 ? selectMetadataProduct([matches[0]], source) : null;
}
