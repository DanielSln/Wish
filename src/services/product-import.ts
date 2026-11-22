import { selectMetadataProduct } from './import-identity.ts';
import { originalImportUrl, consultationImportUrl } from './import-links.ts';
import { microdataProducts } from './product-microdata.ts';
import { importPriceSummary } from '../domain/price-presentation.ts';
import { money } from '../domain/product.ts';
import { selectProductImage } from './product-images.ts';
import { extractPrices, type PriceEvidence } from './import-prices.ts';
import type { ProductInput } from '../domain/product.ts';
import { importHosts, importImageHosts, imageHostMatchesStore, allowedImportRedirect } from './import-policy.ts';

export type ImportedProduct = Pick<ProductInput, 'name' | 'description' | 'image_url' | 'price_cents' | 'store' | 'original_url' | 'notes' | 'offer_details'> & { category_hint?: string };
export type ImportPreview = { product: ImportedProduct; warnings: string[]; prices: PriceEvidence; resolved_url?: string };
const MAX_HTML = 2_000_000;

// Only public HTTPS links; no credentials, local hosts or nonstandard ports.
export function importUrl(value: string): string {
  const url = new URL(originalImportUrl(value));
  url.hash = '';
  return url.href;
}

export function linkImportPlan(value: string) {
  const url = consultationImportUrl(value); const host = new URL(url).hostname;
  return { url, host, automatic: importHosts.has(host) };
}
export function manualProductFromLink(value: string): Partial<ProductInput> {
  const plan = linkImportPlan(value);
  return { original_url: originalImportUrl(value), store: plan.host };
}
export class ProductMetadataUnavailable extends Error {
  readonly code = 'METADATA_UNAVAILABLE';
  constructor() { super('A página respondeu, mas não disponibilizou informações do produto nesta consulta. Você pode preencher manualmente; seu link será mantido.'); }
}

export function importDestination(value: string): string {
  const url = consultationImportUrl(value);
  if (!importHosts.has(new URL(url).hostname)) {
    throw new Error('Esta loja ainda não está habilitada para consulta automática. Use o cadastro manual para preservar o link.');
  }
  return url;
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
  const result: Record<string, string> = Object.create(null);
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    result[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}
function imageUrl(value: unknown, base: string): string {
  const source = typeof value === 'string' ? value : record(value).url;
  if (typeof source !== 'string' || !source.trim()) return '';
  try {
    const url = importUrl(new URL(source, base).href);
    return importImageHosts.has(new URL(url).hostname) && imageHostMatchesStore(new URL(base).hostname, new URL(url).hostname) ? url : '';
  } catch { return ''; }
}
export function extractProduct(html: string, sourceUrl: string, now = Date.now()): ImportPreview {
  const source = importUrl(sourceUrl);
  if (html.length > MAX_HTML) throw new Error('A página é muito grande para importar. Cadastre o produto manualmente.');
  const meta: Record<string, string> = Object.create(null); const imageMetas: Record<string,string>[] = [];
  // Scripts/comments cannot masquerade as HTML metadata. JSON-LD is read separately.
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  for (const tag of markup.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag); imageMetas.push(attrs);
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (key && !(key in meta)) meta[key] = attrs.content ?? '';
  }
  const products: Record<string, unknown>[] = [];
  let nextData: unknown = null;
  function visit(value: unknown, depth = 0) {
    if (depth > 12) return;
    if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return; }
    const item = record(value);
    if (hasSchemaType(item['@type'], 'Product')) products.push(item);
    if (hasSchemaType(item['@type'], 'ProductGroup') && item.hasVariant) visit(item.hasVariant, depth + 1);
    if (item['@graph']) visit(item['@graph'], depth + 1);
    if (item.mainEntity) visit(item.mainEntity, depth + 1);
  }
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = attributes(match[1]);
    if (attrs.id === '__NEXT_DATA__' && attrs.type?.toLowerCase() === 'application/json') { try { nextData = JSON.parse(match[2]); } catch { /* Optional public store metadata. */ } }
    if (!/^application\/ld\+json(?:\s*;|\s*$)/i.test(attrs.type ?? '')) continue;
    try { visit(JSON.parse(match[2])); } catch { /* Malformed metadata is optional. */ }
  }
  if (!products.length) products.push(...microdataProducts(html));
  const selectedProduct = selectMetadataProduct(products, source);
  const ambiguous = products.length > 1 && !selectedProduct;
  if (ambiguous && !meta['og:title']) throw new Error('A página contém vários produtos. Abra o link de um único produto ou cadastre manualmente.');
  // Page-level title/description can remain useful; ambiguous variant prices/images cannot.
  if (products.length > 1) { for (const key of Object.keys(meta)) if (key.startsWith('product:')) delete meta[key]; imageMetas.length = 0; }
  const item = selectedProduct ?? {};
  const name = text(item.name, 160) || text(meta['og:title'], 160);
  const pageText = !products.length ? text(markup, MAX_HTML) : '';
  if (!products.length && /(?:enable JavaScript|ative o JavaScript|habilite o JavaScript)/i.test(pageText)) throw new Error('Esta página depende de JavaScript. Complete os dados manualmente.');
  if (!products.length && /(?:continuar comprando|verify you are human|confirme que voc[eê] [eé] humano|robot check|captcha)/i.test(pageText)) throw new Error('A loja bloqueou a consulta. Complete os dados manualmente.');
  if (!products.length && (new URL(source).pathname === '/' || meta['og:type']?.toLowerCase() === 'website')) throw new ProductMetadataUnavailable();
  const prices = extractPrices(item, meta, source, now, ambiguous ? null : nextData, text(markup.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ''), MAX_HTML));
  const selected = importPriceSummary(prices).lowest;
  const knownPrice = selected?.price_cents ?? null;
  const image = ambiguous ? '' : selectProductImage(item.image, imageMetas, (markup.match(/<img\b[^>]*>/gi) ?? []).map(attributes), source, name, value => imageUrl(value, source));
  if (!products.length && !name && !image && knownPrice === null) throw new ProductMetadataUnavailable();
  const product: ImportedProduct = {
    name,
    description: text(item.description, 10000) || text(meta['og:description'] ?? meta.description, 10000),
    image_url: image,
    price_cents: knownPrice,
    notes: '',
    offer_details: [prices.notes, selected ? `Preço selecionado: ${money(selected.price_cents)} — ${selected.label}.` : 'Preço não confirmado.', `Origem: ${source}`, `Consulta: ${new Date(now).toISOString()}`, ...prices.warnings].filter(Boolean).join('\n'),
    category_hint: text(item.category, 160),
    store: text(meta['og:site_name'], 160) || new URL(source).hostname.slice(0, 160),
    original_url: source,
  };
  return { product, prices, warnings: [
    'Confira os dados na loja antes de salvar. O preço pode variar por vendedor, variante, frete ou promoção.',
    ...prices.warnings,
    ...(ambiguous ? ['Produto ou variante não confirmados; imagem e preço não foram preenchidos.'] : []),
    ...(!name ? ['O nome não foi informado pela página. Preencha-o para desejar.'] : []),
    ...(knownPrice === null ? ['Preço em reais não confirmado; preencha manualmente, se desejar.'] : []),
    ...(!product.image_url ? ['Imagem indisponível; use Adicionar imagem para escolher outra.'] : []),
  ] };
}

// A streaming, redirect-aware transport is mandatory. UI uses expo/fetch on every platform.
export type ImportRequest = (url: string, init: RequestInit) => Promise<Response>;
export async function importProduct(value: string, signal: AbortSignal | undefined, request: ImportRequest, progress?: (stage: 'fetching'|'reading'|'extracting')=>void): Promise<ImportPreview> {
  let url = importDestination(value);
  const trustedStart = url;
  const shortHost = new URL(url).hostname;
  const shortLink = ['meli.la','a.co'].includes(shortHost);
  const original = originalImportUrl(value);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort(); }, 12000);
  try {
    if (controller.signal.aborted) throw new Error('Consulta cancelada.');
    const seen = new Set<string>();
    let response: Response;
    for (let hop=0;;hop++) {
      if (controller.signal.aborted) throw new Error('Consulta cancelada.');
      if (seen.has(url)) throw new Error('O link curto entrou em um ciclo. Use o cadastro manual.');
      seen.add(url);
      progress?.('fetching');
      response = await request(url, { signal: controller.signal, credentials: 'omit', redirect: 'manual', headers: { Accept: 'text/html' } });
      if (response.type === 'opaqueredirect' || response.status === 0) throw new Error('O navegador não permite conferir este redirecionamento. Abra o link no Android ou cadastre manualmente.');
      if (response.url && importDestination(response.url) !== url) { await response.body?.cancel(); throw new Error('O endereço da resposta mudou sem validação. Use o cadastro manual.'); }
      const redirect = response.status >= 300 && response.status < 400;
      if (!redirect) {
        if (response.redirected) { await response.body?.cancel(); throw new Error('Redirecionamentos não são permitidos. Use o cadastro manual.'); }
        if (response.ok && shortLink && ['meli.la','a.co'].includes(new URL(url).hostname)) { await response.body?.cancel(); throw new Error('O link curto não chegou a uma página confiável da loja. Use o cadastro manual.'); }
        break;
      }
      await response.body?.cancel();
      if (hop >= 4 || ![301,302,303,307,308].includes(response.status)) throw new Error('O link curto excedeu o limite de redirecionamentos. Use o cadastro manual.');
      const location = response.headers.get('location');
      if (!location) throw new Error('A loja não informou o destino do link curto. Use o cadastro manual.');
      const next = importUrl(new URL(location,url).href);
      if (!allowedImportRedirect(trustedStart, next)) throw new Error('O link curto aponta para um destino não autorizado. Use o cadastro manual.');
      url = next;
    }
    if (!response.ok) throw new Error([403,429].includes(response.status) ? `A loja bloqueou a consulta (HTTP ${response.status}). Complete os dados manualmente.` : `Loja temporariamente indisponível (HTTP ${response.status}). Tente novamente ou complete os dados.`);
    if (response.url && importDestination(response.url) !== url) throw new Error('O endereço da resposta mudou. Use o link direto ou o cadastro manual.');
    const contentType = response.headers.get('content-type') ?? '';
    if (!/^(text\/html|application\/xhtml\+xml)(?:\s*;|\s*$)/i.test(contentType)) throw new Error('Este link não retornou uma página de produto HTML.');
    if (Number(response.headers.get('content-length')) > MAX_HTML) throw new Error('A página é muito grande para importar. Use o cadastro manual.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('A consulta não disponibilizou leitura limitada. Use o cadastro manual.');
    progress?.('reading');
    const bytes = new Uint8Array(MAX_HTML);
    let size = 0;
    try {
      while (true) {
        if (controller.signal.aborted) throw new Error('Consulta cancelada.');
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (size + chunk.byteLength > MAX_HTML) throw new Error('A página é muito grande para importar. Use o cadastro manual.');
        bytes.set(chunk, size);
        size += chunk.byteLength;
      }
      if (controller.signal.aborted) throw new Error('Consulta cancelada.');
      progress?.('extracting');
      const result = extractProduct(new TextDecoder().decode(bytes.subarray(0, size)), url);
      result.resolved_url = url;
      result.product.original_url = original;
      return result;
    } finally {
      try { await reader.cancel(); } catch { /* The request is also aborted below. */ }
      reader.releaseLock();
    }
  } catch (error) {
    if (timedOut) throw new Error('Importação: tempo esgotado após 12 segundos.');
    if (controller.signal.aborted) throw new Error('Consulta cancelada.');
    if (error instanceof TypeError) throw new Error('Não foi possível acessar a loja. Confira a conexão; a loja pode bloquear importação ou acesso pelo navegador. Use o cadastro manual.');
    throw error;
  } finally {
    controller.abort(); // Also stops downloads rejected by headers before opening a reader.
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
