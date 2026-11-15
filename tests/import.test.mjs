import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractProduct, importProduct, importUrl } from '../src/services/product-import.ts';

const url = 'https://loja.example/produto';
const json = item => `<script type="application/ld+json">${JSON.stringify(item)}</script>`;
const product = { '@type': 'Product', name: 'Fone &amp; música', description: 'Descrição do produto', image: '/fone.png', offers: { '@type': 'Offer', price: '129.90', priceCurrency: 'BRL' } };
test('JSON-LD graph imports explicit BRL price, image and metadata without inventing fields', () => {
  const result = extractProduct(json({ '@graph': [{ '@type': 'Organization' }, product] }), url);
  assert.equal(result.product.name, 'Fone & música');
  assert.equal(result.product.price_cents, 12990);
  assert.equal(result.product.image_url, 'https://loja.example/fone.png');
  assert.equal(result.product.original_url, url);
  assert.equal(result.product.store, 'loja.example');
  assert.equal(result.warnings.length, 1);
});
test('Open Graph fallback accepts either attribute order and malformed JSON-LD', () => {
  const result = extractProduct(`<script type='application/ld+json'>{broken</script>
    <meta content='Livro &quot;novo&quot;' property='og:title'>
    <meta property="og:image" content="/imagem.jpg">
    <meta name=description content='Descrição &amp; detalhes'>
    <meta property='product:price:amount' content='10.25'>
    <meta property='product:price:currency' content='BRL'>`, url);
  assert.equal(result.product.name, 'Livro "novo"');
  assert.equal(result.product.price_cents, 1025);
  assert.equal(result.product.description, 'Descrição & detalhes');
});
test('ambiguous products are refused and uncertain prices stay unknown', () => {
  assert.throws(() => extractProduct(json([product, product]), url), /vários produtos/);
  for (const offers of [
    { price: '10', priceCurrency: 'USD' }, { price: '10' },
    { '@type': 'AggregateOffer', lowPrice: '10', priceCurrency: 'BRL' },
    { '@type': ['Offer', 'AggregateOffer'], price: '10', priceCurrency: 'BRL' },
    { '@type': 'https://schema.org/AggregateOffer', price: '10', priceCurrency: 'BRL' },
    { '@type': 'http://schema.org/AggregateOffer', price: '10', priceCurrency: 'BRL' },
    [{ price: '10', priceCurrency: 'BRL' }, { price: '20', priceCurrency: 'BRL' }],
    { price: 'NaN', priceCurrency: 'BRL' }, { price: '-10', priceCurrency: 'BRL' },
  ]) {
    const result = extractProduct(json({ ...product, offers }), url);
    assert.equal(result.product.price_cents, null);
    assert.ok(result.warnings.some(w => w.includes('não confirmado')));
  }
  assert.equal(extractProduct(json({ ...product, offers: { price: 0, priceCurrency: 'BRL' } }), url).product.price_cents, 0);
});
test('invalid links, absent metadata, huge pages and unsafe images', () => {
  for (const value of ['bad', 'http://loja.example/p', 'https://user:pass@loja.example/p', 'https://localhost/p', 'https://127.0.0.1/p', 'https://10.1.1.1/p', 'https://[::1]/p', 'https://loja.local/p', 'https://loja.local./p', 'https://loja.localhost./p', 'https://localhost./p', 'https://loja.example:3000/p', 'file:///tmp/a']) {
    assert.throws(() => importUrl(value));
  }
  assert.equal(importUrl(` ${url}#detalhes `), url);
  assert.throws(() => extractProduct('<html>Faça login</html>', url), /não disponibilizou/);
  assert.throws(() => extractProduct('x'.repeat(2_000_001), url), /grande/);
  assert.equal(extractProduct(json({ ...product, image: 'javascript:alert(1)' }), url).product.image_url, '');
  assert.throws(() => extractProduct(`<script>const x = '<meta property="og:title" content="falso">';</script>`, url), /não disponibilizou/);
});
test('transport respects blocked responses, CORS errors, content limits and cancellation', async () => {
  let calls = 0;
  const request = async (input, options) => {
    calls++;
    assert.equal(input, url); assert.equal(options.credentials, 'omit');
    return new Response(json(product), { headers: { 'Content-Type': 'text/html' } });
  };
  assert.equal((await importProduct(url, undefined, request)).product.price_cents, 12990);
  assert.equal(calls, 1);
  for (const status of [403, 404, 429]) {
    await assert.rejects(importProduct(url, undefined, async () => new Response('', { status })), new RegExp(`HTTP ${status}`));
  }
  await assert.rejects(importProduct(url, undefined, async () => { throw new TypeError('CORS'); }), /bloquear/);
  await assert.rejects(importProduct(url, undefined, async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })), /HTML/);
  await assert.rejects(importProduct(url, undefined, async () => new Response('', { headers: { 'Content-Type': 'text/html', 'Content-Length': '3000000' } })), /grande/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(importProduct(url, controller.signal, async (_, options) => {
    options.signal.throwIfAborted();
  }), /cancelada/);
  await assert.rejects(importProduct(url, undefined, async () => ({ ok: true, url: 'http://loja.example/redirect' })), /HTTPS/);
});
