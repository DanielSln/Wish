// Exact destinations only: no wildcard subdomains or user-supplied DNS hosts.
// Adding a store/CDN requires code review; membership does not guarantee metadata support.
export const importHosts = new Set([
  'amazon.com.br', 'www.amazon.com.br',
  'mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br',
  'meli.la',
  'magazineluiza.com.br', 'www.magazineluiza.com.br',
  'kabum.com.br', 'www.kabum.com.br',
  'casasbahia.com.br', 'www.casasbahia.com.br',
]);
export const importImageHosts = new Set([
  // Dedicated image CDNs only: store pages may expose redirect endpoints.
  'm.media-amazon.com', 'images-na.ssl-images-amazon.com',
  'http2.mlstatic.com', 'a-static.mlcdn.com.br',
  'images.kabum.com.br', 'static.kabum.com.br',
]);

// Only the dedicated Mercado Livre short-link path may redirect, one validated hop at a time.
export const mercadoLivreHosts = new Set(['mercadolivre.com.br','www.mercadolivre.com.br','produto.mercadolivre.com.br']);
