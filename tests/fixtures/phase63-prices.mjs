// Isolated fixtures, never imported into production. Historical observations are not current prices.
export const observedAt = Date.parse('2026-11-15T12:00:00Z');
export const source = 'https://www.amazon.com.br/phase63-fixture';
export const total = (price, name, extra = {}) => ({ '@type': 'UnitPriceSpecification', price, priceCurrency: 'BRL', priceType: 'SalePrice', name, ...extra });
export function page(options = {}) {
  const { specs = [], extraOffer = {}, product = {} } = options;
  const price = Object.hasOwn(options, 'price') ? options.price : 500;
  return '<script type="application/ld+json">' + JSON.stringify({ '@type': 'Product', name: 'Headset fixture', sku: 'FIXTURE-SKU', description: 'Descrição completa da fixture', offers: { '@type': 'Offer', price, priceCurrency: 'BRL', priceSpecification: specs, ...extraOffer }, ...product }) + '</script>';
}
export const hyperxHistorical = { model: '727A8AA', name: 'HyperX Cloud III — observação histórica', regular: 421.05, final: 339.99, previous: 589.46, coupon: 'HYPERX15' };
