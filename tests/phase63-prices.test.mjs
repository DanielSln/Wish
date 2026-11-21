import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProduct } from '../src/services/product-import.ts';
import { importPriceSummary } from '../src/domain/price-presentation.ts';
import { kabumPage, kabumSource } from './fixtures/kabum-public-pricing.mjs';
import { page, source, observedAt, total, hyperxHistorical } from './fixtures/phase63-prices.mjs';
const parse = options => extractProduct(page(options), source, observedAt);

test('ordinary, sale and lower/higher PIX use explicit totals only', () => {
  assert.equal(parse({}).product.price_cents, 50000);
  assert.equal(parse({specs:[total(400,undefined)]}).product.price_cents,40000);
  for (const [pix,expected] of [[450,45000],[550,50000]]) {
    const result=parse({specs:[total(pix,'À vista no PIX')]});
    assert.equal(result.product.price_cents,expected);
    assert.equal(importPriceSummary(result.prices).lowest.price_cents,expected);
  }
});
test('explicit coupon and combined PIX+coupon totals preserve conditions and source', () => {
  for (const name of ['Com cupom TESTE15','À vista no PIX com cupom TESTE15','PIX + cupom TESTE15','Com cupom TESTE15 no PIX']) {
    const result=parse({specs:[total(400,name,{description:'Somente na campanha pública.'})]});
    assert.equal(result.product.price_cents,40000);
    assert.match(result.product.offer_details,/TESTE15/);
    assert.match(result.product.offer_details,/campanha pública/);
    assert.ok(result.product.offer_details.includes(source));
    if (/PIX/.test(name)) assert.match(result.product.offer_details,/PIX \+ cupom/);
  }
});
test('percentage banners preserve explicit totals, expiry and unrelated coupon evidence', () => {
  const result=extractProduct(kabumPage({offer:{priceSpecification:total(70,'Com cupom TESTE15')}}),kabumSource,observedAt);
  assert.equal(result.prices.coupon.price_cents,7000);assert.equal(result.product.price_cents,7000);
  const expired=extractProduct(kabumPage({offer:{priceSpecification:total(70,'Com cupom TESTE15',{validThrough:'2020-01-01'})}}),kabumSource,observedAt);
  assert.equal(expired.prices.coupon.expired,true);assert.equal(expired.product.price_cents,8000);
  const other=extractProduct(kabumPage({offer:{priceSpecification:total(70,'Com cupom OUTRO15')}}),kabumSource,observedAt);
  assert.equal(other.prices.coupon.code,'OUTRO15');assert.equal(other.prices.coupon.price_cents,7000);assert.match(other.product.offer_details,/TESTE15/);
});
test('percent-only coupons and session-exclusive campaigns never produce an inferred final', () => {
  const result=extractProduct(kabumPage(),kabumSource,observedAt);
  assert.equal(result.prices.coupon.price_cents,null);assert.equal(result.product.price_cents,8000);
  const session=extractProduct(kabumPage({product:{offer:{login:true}}}),kabumSource,observedAt);
  assert.equal(session.product.price_cents,null);
});
test('reference, installment, shipping and cashback values are excluded', () => {
  for (const name of ['Parcela','Frete','Cashback']) assert.equal(parse({specs:[total(10,name)]}).product.price_cents,50000);
  for (const priceType of ['ListPrice','StrikethroughPrice','MSRP']) assert.equal(parse({price:150,specs:[total(150,undefined,{priceType})]}).product.price_cents,null);
  assert.equal(parse({specs:[total(10,'Com cupom TESTE15',{priceComponentType:'DeliveryChargeSpecification'})]}).product.price_cents,50000);
});
test('ambiguous prices, variant mismatch, unavailable and missing prices remain conservative', () => {
  assert.equal(parse({specs:[total(100,undefined),total(200,undefined)]}).product.price_cents,null);
  assert.equal(parse({extraOffer:{itemOffered:{sku:'ANOTHER-VARIANT'}}}).product.price_cents,null);
  assert.equal(parse({extraOffer:{availability:'https://schema.org/OutOfStock'}}).product.price_cents,null);
  assert.equal(parse({price:undefined}).product.price_cents,null);
  assert.equal(parse({extraOffer:{priceCurrency:'USD'}}).product.price_cents,null);
  assert.throws(()=>extractProduct(page()+page(),source,observedAt),/vários produtos/);
});
test('historical HyperX example is synthetic explicit evidence, never a current-price guarantee', () => {
  const f=hyperxHistorical;
  const result=parse({price:f.regular,specs:[total(f.final,'PIX com cupom '+f.coupon)],product:{name:f.name,mpn:f.model}});
  assert.equal(result.product.price_cents,33999);assert.match(result.product.offer_details,/PIX \+ cupom/);
});

test('multiple coupon conditions compare explicit totals; same-condition conflicts are rejected',()=>{
  const result=parse({specs:[total(400,'Com cupom TESTE15'),total(350,'PIX com cupom TESTE15')]});
  assert.equal(result.product.price_cents,35000);assert.match(result.product.offer_details,/PIX \+ cupom/);
  const conflict=parse({specs:[total(400,'Com cupom TESTE15'),total(350,'Com cupom TESTE15')]});
  assert.equal(conflict.product.price_cents,50000);assert.ok(conflict.warnings.some(w=>/conflitantes/.test(w)));
});
test('PIX metadata conflict never silently selects one of the incompatible sources',()=>{
  const result=extractProduct(kabumPage({offer:{priceSpecification:total(60,'PIX')}}),kabumSource,observedAt);
  assert.equal(result.prices.conditional,null);assert.equal(result.product.price_cents,10000);
});
test('an advertised sale higher than ordinary never increases the selected price',()=>{
  assert.equal(parse({price:500,specs:[total(600,undefined)]}).product.price_cents,50000);
});

test('identified product metadata can open an incomplete draft without price, image or name',()=>{
  const result=parse({price:undefined,product:{name:undefined}});
  assert.equal(result.product.name,'');assert.equal(result.product.price_cents,null);assert.equal(result.product.image_url,'');
});
