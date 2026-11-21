// Exact destinations only: no wildcard subdomains or user-supplied DNS hosts.
// Adding a store/CDN requires code review; membership does not guarantee metadata support.
export const importHosts = new Set([
  'amazon.com.br', 'www.amazon.com.br', 'a.co',
  'mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br',
  'meli.la',
  'magazineluiza.com.br', 'www.magazineluiza.com.br',
  'kabum.com.br', 'www.kabum.com.br',
  'casasbahia.com.br', 'www.casasbahia.com.br',
  'youcom.com.br', 'www.youcom.com.br',
]);
export const importImageHosts = new Set([
  // Dedicated image CDNs only: store pages may expose redirect endpoints.
  'm.media-amazon.com', 'images-na.ssl-images-amazon.com',
  'http2.mlstatic.com', 'a-static.mlcdn.com.br',
  'images.kabum.com.br', 'static.kabum.com.br',
  'img.youcom.com.br',
  // Exact image hosts observed on official public pages on 20 Nov 2026.
  'imgs.casasbahia.com.br', 'www.casasbahia-imagens.com.br',
  'ae-pic-a1.aliexpress-media.com', 'wx.mlcdn.com.br',
]);

// Exact Mercado Livre family; every redirect is checked against the original family.
export const mercadoLivreHosts = new Set(['mercadolivre.com.br','www.mercadolivre.com.br','produto.mercadolivre.com.br']);

// Keep a product's imported image on its own reviewed store/CDN family.
export function imageHostMatchesStore(sourceHost: string, imageHost: string): boolean {
  const groups = [
    { stores: ['amazon.com.br','www.amazon.com.br'], images: ['m.media-amazon.com','images-na.ssl-images-amazon.com'] },
    { stores: [...mercadoLivreHosts,'meli.la'], images: ['http2.mlstatic.com'] },
    { stores: ['magazineluiza.com.br','www.magazineluiza.com.br'], images: ['a-static.mlcdn.com.br','wx.mlcdn.com.br'] },
    { stores: ['kabum.com.br','www.kabum.com.br','images.kabum.com.br','static.kabum.com.br'], images: ['images.kabum.com.br','static.kabum.com.br'] },
    { stores: ['youcom.com.br','www.youcom.com.br'], images: ['img.youcom.com.br'] },
    { stores: ['casasbahia.com.br','www.casasbahia.com.br'], images: ['imgs.casasbahia.com.br','www.casasbahia-imagens.com.br'] },
    { stores: ['aliexpress.com','www.aliexpress.com','pt.aliexpress.com'], images: ['ae-pic-a1.aliexpress-media.com'] },
  ];
  const group = groups.find(g => g.stores.includes(sourceHost));
  return !!group && group.images.includes(imageHost);
}

// Network destinations are reviewed independently from metadata adapters. Unknown
// DNS names are manual-only: expo/fetch cannot pin DNS or inspect the connected IP.
export function importFamily(host: string): string | null {
  if (['a.co','amazon.com.br','www.amazon.com.br'].includes(host)) return 'amazon';
  if (host === 'meli.la' || mercadoLivreHosts.has(host)) return 'mercadolivre';
  return importHosts.has(host) ? host.replace(/^www\./, '') : null;
}
export function allowedImportRedirect(from: string, to: string): boolean {
  const a = importFamily(new URL(from).hostname); const b = importFamily(new URL(to).hostname);
  return a !== null && a === b;
}
