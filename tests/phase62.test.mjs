import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboardOverlap } from '../src/domain/keyboard-layout.ts';
import { importPriceSummary } from '../src/domain/price-presentation.ts';
const evidence=(current,conditional=null,original=499900)=>({current_cents:current,original_cents:original,conditional,coupon:null,warnings:[],notes:''});
test('keyboard reserves only actual overlap; already resized viewport is not shifted twice',()=>{
 assert.equal(keyboardOverlap(100,700,500),300);assert.equal(keyboardOverlap(100,400,500),0);assert.equal(keyboardOverlap(100,320,500),0);assert.equal(keyboardOverlap(100,700,undefined),0);assert.equal(keyboardOverlap(100,700,100),700);assert.equal(keyboardOverlap(0,500,NaN),0);
});
test('PIX presentation highlights the lower structured price without mutating common/original values',()=>{
 const prices=evidence(449900,{price_cents:418407,label:'À vista no PIX'});const before=structuredClone(prices);const summary=importPriceSummary(prices);
 assert.deepEqual(summary.lowest,{price_cents:418407,label:'À vista no PIX',conditional:true});assert.equal(summary.current,449900);assert.equal(summary.original,499900);assert.deepEqual(prices,before);
});
test('former prices never become current offers; explicit coupon totals are eligible and invalid prices stay unknown',()=>{
 const p={...evidence(null,null,1000),coupon:{price_cents:500,percent:90,code:'FIXTURE',conditions:'conditional',expired:false,amount_cents:null}};
 assert.equal(importPriceSummary(p).lowest.price_cents,500);assert.equal(importPriceSummary(evidence(-1,{price_cents:NaN,label:'PIX'})).lowest,null);assert.equal(importPriceSummary(evidence(null,{price_cents:1990,label:'PIX'})).lowest.conditional,true);
 assert.equal(importPriceSummary(evidence(2000,{price_cents:3000,label:'PIX'})).lowest.conditional,false);assert.equal(importPriceSummary(evidence(2000,{price_cents:2000,label:'PIX'})).lowest.conditional,false);assert.equal(importPriceSummary(evidence(0)).lowest.price_cents,0);
});
