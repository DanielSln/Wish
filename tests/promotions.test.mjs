import test from 'node:test';
import assert from 'node:assert/strict';
import {extractProduct} from '../src/services/product-import.ts';
import {kabumPage,kabumSource,pricingTime as now} from './fixtures/kabum-public-pricing.mjs';
const source='https://www.amazon.com.br/product-fixture';
const spec=(price,type='SalePrice',extra={})=>({'@type':'UnitPriceSpecification',price,priceCurrency:'BRL',priceType:'https://schema.org/'+type,...extra});
const page=offers=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Fixture',offers})+'</script>';
const parse=offers=>extractProduct(page(offers),source,now);
const offer=extra=>({'@type':'Offer',price:100,priceCurrency:'BRL',...extra});
test('explicit promotional price wins; list-only or MSRP is not imported as current',()=>{
 const r=parse(offer({price:150,priceSpecification:[spec(150,'StrikethroughPrice'),spec(100)]}));assert.equal(r.product.price_cents,10000);assert.equal(r.prices.original_cents,15000);assert.match(r.product.offer_details,/150/);
 for(const type of ['ListPrice','StrikethroughPrice','MSRP'])assert.equal(parse(offer({price:150,priceSpecification:spec(150,type)})).product.price_cents,null);
 const plain=parse(offer({price:undefined,priceSpecification:{'@type':'UnitPriceSpecification',price:100,priceCurrency:'BRL'}}));assert.equal(plain.product.price_cents,10000);
});
test('Open Graph explicit sale and original are separate and expiry/currency still apply',()=>{
 const meta='<meta property="og:title" content="Fixture"><meta property="product:price:amount" content="150"><meta property="product:price:currency" content="BRL"><meta property="product:original_price:amount" content="150"><meta property="product:original_price:currency" content="BRL"><meta property="product:sale_price:amount" content="100"><meta property="product:sale_price:currency" content="BRL">';
 const r=extractProduct(meta,source,now);assert.equal(r.product.price_cents,10000);assert.equal(r.prices.original_cents,15000);
 assert.equal(extractProduct(meta+'<meta property="product:sale_price_dates:end" content="2026-11-14">',source,now).product.price_cents,null);
 assert.equal(extractProduct(page(offer({priceCurrency:'USD'}))+meta,source,now).product.price_cents,null);
});
test('explicit coupon final is selected without calculating or applying a coupon in the store',()=>{
 const r=parse(offer({priceSpecification:spec(85,'SalePrice',{name:'Com cupom PUBLICO15',validThrough:'2026-11-16'})}));assert.equal(r.product.price_cents,8500);assert.equal(r.prices.coupon.code,'PUBLICO15');assert.equal(r.prices.coupon.price_cents,8500);assert.equal(r.prices.coupon.percent,null);assert.match(r.product.offer_details,/PUBLICO15/);
 const alreadyConditional=parse(offer({price:85,priceSpecification:spec(85,'SalePrice',{name:'Com cupom PUBLICO15'})}));assert.equal(alreadyConditional.product.price_cents,8500);
});
test('minimum spend, membership and payment conditions never become guaranteed final prices',()=>{
 const r=parse(offer({priceSpecification:spec(85,'SalePrice',{name:'Com cupom PUBLICO15',description:'Somente membros e pagamento elegível.',eligibleTransactionVolume:{minPrice:150,priceCurrency:'BRL'},validForMemberTier:'https://example.test/tier'})}));assert.equal(r.product.price_cents,8500);assert.match(r.prices.coupon.conditions,/Compra mínima/);assert.match(r.prices.coupon.conditions,/elegibilidade/);
 assert.equal(parse(offer({eligibleQuantity:{minValue:2}})).product.price_cents,null);
 assert.equal(parse(offer({price:80,priceSpecification:spec(80,'SalePrice',{description:'Somente PIX'})})).product.price_cents,null);
 assert.equal(parse(offer({price:10,priceSpecification:spec(10,'SalePrice',{priceComponentType:'https://schema.org/Installment'})})).product.price_cents,null);
 assert.equal(parse(offer({priceSpecification:spec(85,'ListPrice',{name:'Com cupom TESTE15'})})).prices.coupon.price_cents,null);
});
test('expired or unverifiable coupons leave the ordinary price and no coupon final value',()=>{
 for(const extra of [{validThrough:'2026-11-14'},{validThrough:'unknown'},{validFrom:'2026-11-16'}]){
  const r=parse(offer({priceSpecification:spec(85,'SalePrice',{name:'Com cupom TESTE15',...extra})}));assert.equal(r.product.price_cents,10000);assert.equal(r.prices.coupon.price_cents,null);assert.equal(r.prices.coupon.expired,true);
 }
 const unknown=parse(offer({priceSpecification:spec('not-a-price','SalePrice',{name:'Com cupom TESTE15'})}));assert.equal(unknown.prices.coupon.price_cents,null);assert.equal(unknown.product.price_cents,10000);
});
test('conflicting sales, absent price, ambiguous offers and expired offers remain conservative',()=>{
 assert.equal(parse(offer({priceSpecification:[spec(80),spec(90)]})).product.price_cents,null);
 assert.equal(parse(offer({price:undefined})).product.price_cents,null);
 assert.equal(parse([offer({}),offer({price:90})]).product.price_cents,null);
 assert.equal(parse(offer({priceValidUntil:'2026-11-14',priceSpecification:spec(80)})).product.price_cents,null);
});
test('KaBuM public embedded data separates previous, ordinary, PIX and public coupon',()=>{
 const r=extractProduct(kabumPage(),kabumSource,now);assert.equal(r.product.price_cents,8000);assert.equal(r.prices.original_cents,15000);assert.deepEqual(r.prices.conditional,{price_cents:8000,label:'À vista no PIX'});assert.equal(r.prices.coupon.code,'TESTE15');assert.equal(r.prices.coupon.percent,15);assert.equal(r.prices.coupon.price_cents,null);assert.match(r.prices.coupon.conditions,/limitados/);assert.equal(r.product.original_url,kabumSource);
});
test('percentage coupon is not confused with fixed-value discount and neither is calculated',()=>{
 const r=extractProduct(kabumPage({banner:'Use o cupom FIXO15 e ganhe R$ 15,00 de desconto neste item. Consulte condições.'}),kabumSource,now);assert.equal(r.prices.coupon.amount_cents,1500);assert.equal(r.prices.coupon.percent,null);assert.equal(r.prices.coupon.price_cents,null);assert.equal(r.product.price_cents,8000);
});
test('store adapter rejects other SKU, marketplace, exclusivity, unknown validity and stale campaign',()=>{
 for(const product of [{id:67890},{sellerId:1},{prime:{isLoggedUserExclusive:true}},{offer:{endDate:now/1000-1}},{offer:{startDate:now/1000+1}},{offer:{endDate:'unknown'}},{offer:{login:true}},{available:false}]){
  const r=extractProduct(kabumPage({product}),kabumSource,now);assert.equal(r.product.price_cents,null);assert.equal(r.prices.conditional,null);assert.equal(r.prices.original_cents,null);
 }
 assert.equal(extractProduct(kabumPage({offer:{priceCurrency:'USD'}}),kabumSource,now).product.price_cents,null);
 const elsewhere=extractProduct(kabumPage(),source,now);assert.equal(elsewhere.prices.conditional,null);assert.equal(elsewhere.prices.coupon,null);
});
