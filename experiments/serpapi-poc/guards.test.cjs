const {test} = require('node:test');
const assert = require('node:assert/strict');
const {scrub,project,freeAccount,canReserve,safeAccount} = require('./run.cjs');
const account = {account_status:'Active',plan_id:'free',plan_monthly_price:0,plan_renewal_date:'2026-12-21',total_searches_left:250,extra_credits:0,account_rate_limit_per_hour:250,this_hour_searches:0,last_hour_searches:0};
test('requires an active zero-cost Free plan and known remaining balance',()=>{
  assert.equal(freeAccount(account),true);
  for (const change of [{plan_id:'paid'},{plan_monthly_price:1},{total_searches_left:0},{extra_credits:1},{account_status:'Disabled'},{plan_renewal_date:null}]) assert.equal(freeAccount({...account,...change}),false);
});
test('enforces absolute forty attempts even after a new hour',()=>{
  assert.equal(canReserve({attempts:Array.from({length:40},()=>({at:0,caseId:'other'}))},'new',7200000,account),false);
});
test('limits each case to three attempts and respects provider throughput',()=>{
  assert.equal(canReserve({attempts:[1,2,3].map(at=>({at,caseId:'a'}))},'a',10,account),false);
  assert.equal(canReserve({attempts:[]},'a',10,{...account,this_hour_searches:40}),false);
  assert.equal(canReserve({attempts:[]},'a',10,account),true);
});
test('does not publish raw account credentials or unapproved response fields',()=>{
  assert.equal('api_key' in safeAccount({...account,api_key:'private'}),false);
  assert.equal('account_email' in safeAccount({...account,account_email:'private'}),false);
  const v=project({api_key:'private',search_metadata:{json_endpoint:'private'},organic_results:[{title:'private',link:'https://example.org/?api_key=private',unapproved:'private'}]},'private');
  assert.equal(JSON.stringify(v).includes('private'),false);
  assert.equal('search_metadata' in v,false);
  assert.equal(v.organic_results[0].title,'[REDACTED]');
  assert.equal(scrub('https://example.org/?api_key=other'),'https://example.org/?api_key=[REDACTED]');
});
test('preserves explicit installments, stock evidence and description without deriving a total',()=>{
  const v=project({product_results:{about_the_product:{description:'Product description'},stores:[{price:'R$ 27,39',total:'R$ 279,99',installments_description:'12x de R$ 27,39 (com juros)',details_and_offers:['Em estoque on-line'],coupon:'EXAMPLE'}]}},'');
  assert.equal(v.product_results.about_the_product.description,'Product description');
  assert.equal(v.product_results.stores[0].total,'R$ 279,99');
  assert.equal(v.product_results.stores[0].installments_description,'12x de R$ 27,39 (com juros)');
  assert.deepEqual(v.product_results.stores[0].details_and_offers,['Em estoque on-line']);
});
