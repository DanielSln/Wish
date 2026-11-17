type Attributes = Record<string, string>;
type Candidate = { url: string; width: number; height: number; primary: boolean; order: number };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function dimension(value: unknown): number {
  const number = Number(typeof value === 'object' ? object(value).value : value);
  return Number.isFinite(number) && number > 0 && number <= 20000 ? number : 0;
}
const normalized = (value: string) => value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');

// Only URLs actually declared by this product page are candidates. No guessed CDN sizes.
export function selectProductImage(
  jsonImage: unknown, metas: Attributes[], images: Attributes[], source: string, name: string,
  safeUrl: (value: unknown) => string,
): string {
  const candidates: Candidate[] = [];
  function add(value: unknown, width: unknown = 0, height: unknown = 0, primary = false) {
    const url = safeUrl(value);
    if (!url) return;
    const existing = candidates.find(c => c.url === url);
    if (existing) { existing.width = Math.max(existing.width, dimension(width)); existing.height = Math.max(existing.height, dimension(height)); existing.primary ||= primary; return; }
    if (candidates.length < 100) candidates.push({ url, width: dimension(width), height: dimension(height), primary, order: candidates.length });
  }
  function visit(value: unknown, depth = 0) {
    if (depth > 4) return;
    if (Array.isArray(value)) { value.slice(0,100).forEach(v => visit(v, depth + 1)); return; }
    if (typeof value === 'string') { add(value); return; }
    const image = object(value);
    add(image.contentUrl ?? image.url, image.width, image.height);
  }
  visit(jsonImage);
  let openGraph: { value: string; width?: string; height?: string } | null = null;
  let twitter: { value: string; width?: string; height?: string } | null = null;
  const finish = () => { if (openGraph) add(openGraph.value, openGraph.width, openGraph.height); };
  for (const attrs of metas) {
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase(); const value = attrs.content ?? '';
    if (key === 'og:image' || key === 'og:image:url') { finish(); openGraph = { value }; }
    else if (key === 'og:image:secure_url') { if (safeUrl(value)) { if (openGraph) openGraph.value = value; else openGraph = { value }; } }
    else if (key === 'og:image:width' && openGraph) openGraph.width = value;
    else if (key === 'og:image:height' && openGraph) openGraph.height = value;
    else if (key === 'twitter:image' || key === 'twitter:image:src') twitter = { value };
    else if (key === 'twitter:image:width' && twitter) twitter.width = value;
    else if (key === 'twitter:image:height' && twitter) twitter.height = value;
  }
  finish(); if (twitter) add(twitter.value, twitter.width, twitter.height);

  const declared = new Set(candidates.map(c => c.url));
  // A same-origin Next.js wrapper may identify a URL ALREADY in product metadata.
  // Never request the optimizer or invent/unwarp a new image endpoint.
  function declaredUrl(value: string) {
    const direct = safeUrl(value);
    if (declared.has(direct)) return direct;
    try {
      const wrapper = new URL(value, source);
      if (wrapper.origin !== new URL(source).origin || wrapper.pathname !== '/_next/image') return '';
      const nested = safeUrl(wrapper.searchParams.get('url'));
      return declared.has(nested) ? nested : '';
    } catch { return ''; }
  }
  for (const attrs of images.slice(0,300)) {
    const representative = attrs.itemprop?.split(/\s+/).includes('image') || (attrs.fetchpriority?.toLowerCase() === 'high' && !!name && normalized(attrs.alt ?? '') === normalized(name));
    if (!representative) continue;
    const anchor = declaredUrl(attrs.src ?? '') || declaredUrl(attrs['data-src'] ?? '');
    if (!anchor) continue; // Avoid recommendation, banner and other-product galleries.
    add(anchor, 0, 0, true);
    for (const part of (attrs.srcset ?? '').split(',').slice(0,30)) {
      const match = part.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)(w|x)$/);
      if (!match) continue;
      const known = declaredUrl(match[1]);
      if (known) { const direct = safeUrl(match[1]) === known; add(known, direct && match[3] === 'w' ? match[2] : direct && match[3] === 'x' && Number(match[2]) <= 4 ? dimension(attrs.width) * Number(match[2]) : 0, 0, true); continue; }
      // Direct srcset alternatives of the anchored product image, exactly as published.
      const url = safeUrl(match[1]);
      if (url && match[3] === 'w') add(url, match[2], 0, true);
      else if (url && match[3] === 'x' && Number(match[2]) <= 4) add(url, dimension(attrs.width) * Number(match[2]), 0, true);
    }
  }
  const score = (candidate: Candidate) => candidate.width || (candidate.primary ? 20000 : 0);
  candidates.sort((a,b) => score(b) - score(a) || Number(b.primary) - Number(a.primary) || b.height - a.height || a.order - b.order);
  return candidates[0]?.url ?? '';
}
