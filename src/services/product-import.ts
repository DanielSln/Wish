import { parsePrice } from '../domain/product.ts';
import type { ProductInput } from '../domain/product.ts';

export type ImportedProduct = Pick<ProductInput, 'name' | 'description' | 'image_url' | 'price_cents' | 'store' | 'original_url'>;
export type ImportPreview = { product: ImportedProduct; warnings: string[] };
const MAX_HTML = 2_000_000;

// Only public HTTPS links; no credentials, local hosts or nonstandard ports.
export function importUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Informe um link HTTPS válido da loja.'); }
  // A trailing DNS root dot must not bypass local-host checks.
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') ||
      host.includes(':') || /^[\d.]+$/.test(host)) {
    throw new Error('Use um link HTTPS público da loja, sem credenciais ou endereço de rede local.');
  }
  if (url.href.length > 2048) throw new Error('O link deve ter até 2048 caracteres.');
  url.hash = '';
  return url.href;
}

function decode(value: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (original, entity: string) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? original;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}
const text = (value: unknown, max: number) => typeof value === 'string' ? decode(value).replace(/<[^>]*>/g, '').trim().slice(0, max) : '';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function hasSchemaType(value: unknown, expected: string): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some(type => type === expected || type === `https://schema.org/${expected}` || type === `http://schema.org/${expected}`);
}
function attributes(tag: string) {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    result[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}
function imageUrl(value: unknown, base: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  const source = typeof candidate === 'string' ? candidate : record(candidate).url;
  if (typeof source !== 'string' || !source.trim()) return '';
  try { return importUrl(new URL(source, base).href); } catch { return ''; }
}
function price(value: unknown, currency: unknown): number | null {
  // Never infer currency, use an aggregate lowPrice or convert foreign prices.
  if (currency !== 'BRL' || !['string', 'number'].includes(typeof value)) return null;
  try { return parsePrice(String(value)); } catch { return null; }
}

export function extractProduct(html: string, sourceUrl: string): ImportPreview {
  const source = importUrl(sourceUrl);
  if (html.length > MAX_HTML) throw new Error('A página é muito grande para importar. Cadastre o produto manualmente.');
  const meta: Record<string, string> = {};
  // Scripts/comments cannot masquerade as HTML metadata. JSON-LD is read separately.
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  for (const tag of markup.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (key && !(key in meta)) meta[key] = attrs.content ?? '';
  }
  const products: Record<string, unknown>[] = [];
  function visit(value: unknown, depth = 0) {
    if (depth > 12) return;
    if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return; }
    const item = record(value);
    if (hasSchemaType(item['@type'], 'Product')) products.push(item);
    if (item['@graph']) visit(item['@graph'], depth + 1);
    if (item.mainEntity) visit(item.mainEntity, depth + 1);
  }
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attributes(match[1]).type?.toLowerCase() !== 'application/ld+json') continue;
    try { visit(JSON.parse(match[2])); } catch { /* Malformed metadata is optional. */ }
  }
  if (products.length > 1) throw new Error('A página contém vários produtos. Abra o link de um único produto ou cadastre manualmente.');
  const item = products[0] ?? {};
  const name = text(item.name, 160) || text(meta['og:title'], 160);
  if (!name) throw new Error('A loja não disponibilizou dados do produto. Você pode cadastrá-lo manualmente.');
  const offers = Array.isArray(item.offers) ? item.offers : item.offers ? [item.offers] : [];
  const offer = offers.length === 1 ? record(offers[0]) : {};
  const isAggregate = hasSchemaType(offer['@type'], 'AggregateOffer');
  const knownPrice = offers.length ? (isAggregate ? null : price(offer.price, offer.priceCurrency)) : price(meta['product:price:amount'], meta['product:price:currency']);
  const product: ImportedProduct = {
    name,
    description: text(item.description, 10000) || text(meta['og:description'] ?? meta.description, 10000),
    image_url: imageUrl(item.image, source) || imageUrl(meta['og:image'], source),
    price_cents: knownPrice,
    store: text(meta['og:site_name'], 160) || new URL(source).hostname.slice(0, 160),
    original_url: source,
  };
  return { product, warnings: [
    'Confira os dados na loja antes de salvar. O preço pode variar por vendedor, variante, frete ou promoção.',
    ...(knownPrice === null ? ['Preço em reais não confirmado; preencha manualmente, se desejar.'] : []),
    ...(!product.image_url ? ['Imagem indisponível; você pode adicionar uma URL no formulário.'] : []),
  ] };
}

export async function importProduct(value: string, signal?: AbortSignal, request: typeof fetch = fetch): Promise<ImportPreview> {
  const url = importUrl(value);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await request(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`A loja recusou ou não encontrou a página (HTTP ${response.status}). Use o cadastro manual.`);
    if (response.url) importUrl(response.url);
    const contentType = response.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error('Este link não retornou uma página de produto HTML.');
    if (Number(response.headers.get('content-length')) > MAX_HTML) throw new Error('A página é muito grande para importar. Use o cadastro manual.');
    return extractProduct(await response.text(), response.url || url);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Importação cancelada ou tempo esgotado. Tente novamente ou cadastre manualmente.');
    if (error instanceof TypeError) throw new Error('Não foi possível acessar a loja. Confira a conexão; a loja pode bloquear importação ou acesso pelo navegador. Use o cadastro manual.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
