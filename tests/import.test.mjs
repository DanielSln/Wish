import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractProduct, importProduct, importUrl, importDestination } from '../src/services/product-import.ts';

const url = 'https://www.amazon.com.br/produto';
const json = item => `<script type="application/ld+json">${JSON.stringify(item)}</script>`;
const product = { '@type': 'Product', name: 'Fone &amp; música', description: 'Descrição do produto', image: 'https://m.media-amazon.com/fone.png', offers: { '@type': 'Offer', price: '129.90', priceCurrency: 'BRL' } };
test('JSON-LD graph imports explicit BRL price, image and metadata without inventing fields', () => {
  const result = extractProduct(json({ '@graph': [{ '@type': 'Organization' }, product] }), url);
  assert.equal(result.product.name, 'Fone & música');
  assert.equal(result.product.price_cents, 12990);
  assert.equal(result.product.image_url, 'https://m.media-amazon.com/fone.png');
  assert.equal(result.product.original_url, url);
  assert.equal(result.product.store, 'www.amazon.com.br');
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
  for (const value of ['bad', 'http://loja.example/p', 'https://user:pass@loja.example/p', 'https://localhost/p', 'https://127.0.0.1/p', 'https://10.1.1.1/p', 'https://[::1]/p', 'https://loja.local/p', 'https://loja.local./p', 'https://loja.localhost./p', 'https://localhost./p', 'https://www.amazon.com.br:3000/p', 'file:///tmp/a']) {
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
    assert.equal(input, url); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
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

test('automatic requests reject arbitrary hosts before network and images use exact CDN hosts', async () => {
  let calls = 0;
  for (const host of ['loja.example', 'www.amazon.com.br.attacker.example', 'shop.amazon.com.br', '127.0.0.1.nip.io', 'localhost.localdomain', '169.254.169.254']) {
    await assert.rejects(importProduct(`https://${host}/p`, undefined, async () => { calls++; }), /manual|HTTPS/);
  }
  assert.equal(calls, 0);
  assert.equal(importDestination('https://WWW.AMAZON.COM.BR./p#x'), 'https://www.amazon.com.br/p');
  for (const image of ['https://127.0.0.1.nip.io/a', 'https://m.media-amazon.com.attacker.example/a']) {
    assert.equal(extractProduct(json({ ...product, image }), url).product.image_url, '');
  }
  assert.equal(extractProduct(json({ ...product, image: 'https://m.media-amazon.com/a.jpg' }), url).product.image_url, 'https://m.media-amazon.com/a.jpg');
  assert.equal(extractProduct(json({ ...product, image: '/a.jpg' }), 'https://images.kabum.com.br/p').product.image_url, 'https://images.kabum.com.br/a.jpg');
  assert.equal(extractProduct(json({ ...product, image: 'https://www.amazon.com.br/redirect?target=http://127.0.0.1' }), url).product.image_url, '');
  // An unlisted store's link remains usable by the manual form without a network request.
  assert.equal(importUrl('https://outra-loja.example/p'), 'https://outra-loja.example/p');
});

test('streaming enforces byte limit without Content-Length or buffered text fallback', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2_000_001)); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/html', 'Content-Length': '1' } });
  response.text = async () => { throw new Error('must never buffer text'); };
  await assert.rejects(importProduct(url, undefined, async () => response), /grande/);
  assert.equal(cancelled, true);
  await assert.rejects(importProduct(url, undefined, async () => new Response(null, { headers: { 'Content-Type': 'text/html' } })), /leitura limitada/);
});

test('stream decoding handles UTF-8 across chunks and releases the transport', async () => {
  const encoded = new TextEncoder().encode(json(product));
  const response = new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < encoded.length; i++) controller.enqueue(encoded.subarray(i, i + 1));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  let transportSignal;
  const result = await importProduct(url, undefined, async (_, options) => { transportSignal = options.signal; return response; });
  assert.equal(result.product.name, 'Fone & música');
  assert.equal(transportSignal.aborted, true);
});

test('redirect responses and unexpected final URLs never reach the parser', async () => {
  await assert.rejects(importProduct(url, undefined, async () => new Response('', { status: 302, headers: { Location: 'https://127.0.0.1/private' } })), /Redirecionamentos/);
  await assert.rejects(importProduct(url, undefined, async () => ({ redirected: true, status: 200 })), /Redirecionamentos/);
  await assert.rejects(importProduct(url, undefined, async () => ({ ok: true, status: 200, url: 'https://www.kabum.com.br/other' })), /endereço da resposta/);
});

test('timeout aborts a slow body and cancels its stream', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = false;
  const pending = importProduct(url, undefined, async (_, options) => new Response(new ReadableStream({
    start(controller) {
      options.signal.addEventListener('abort', () => { cancelled = true; controller.error(new Error('aborted')); });
    },
  }), { headers: { 'Content-Type': 'text/html' } }));
  const rejection = assert.rejects(pending, /tempo esgotado/);
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(12000);
  await rejection;
  assert.equal(cancelled, true);
});

test('expired, future or malformed offer validity never becomes a current price or falls back to OG', () => {
  const now=Date.parse('2026-11-15T12:00:00Z');
  for(const dates of [
    {priceValidUntil:'2026-11-14'}, {validThrough:'2026-11-15T11:59:59Z'},
    {validFrom:'2026-11-16'}, {priceValidUntil:'not-a-date'}, {priceValidUntil:null},
    {priceValidUntil:'2026-02-31'}, {validFrom:'2026-11-15T00:00:00'},
  ]) {
    const result=extractProduct(json({...product,offers:{...product.offers,...dates}})+"<meta property='product:price:amount' content='12'><meta property='product:price:currency' content='BRL'>",url,now);
    assert.equal(result.product.price_cents,null);assert.equal(result.product.name,'Fone & música');
    assert.equal(result.product.original_url,url);assert.equal(result.product.description,'Descrição do produto');
    assert.ok(result.warnings.some(w=>w.includes('validade')));
  }
});

test('offer validity boundaries allow a declared BRL price without claiming a live price', () => {
  const now=Date.parse('2026-11-15T12:00:00Z');
  for(const dates of [{priceValidUntil:'2026-11-15'},{validFrom:'2026-11-15'},{validThrough:'2026-11-15T12:00:00Z'},{priceValidUntil:'2026-11-15T13:00:00+01:00'}]) {
    const result=extractProduct(json({...product,offers:{...product.offers,...dates}}),url,now);
    assert.equal(result.product.price_cents,12990);assert.ok(result.warnings.some(w=>w.includes('Confira')));
  }
});
