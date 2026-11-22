// Isolated research CLI. No production imports, dependencies or secrets on disk.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, '.expo/serpapi-poc');
const STATE = path.join(DIR, 'state.json');
const LOCK = path.join(DIR, 'exclusive.lock');
const LIMIT = 40;
const HOUR = 3600000;
const allowed = new Set(('title name brand model sku gtin mpn asin position link product_link source price extracted_price old_price extracted_old_price currency description snippet thumbnails thumbnail image stock availability delivery shipping extracted_shipping total extracted_total payment_methods payment_options extensions tag condition rating reviews price_range store seller merchant fulfillment variants options product_highlights highlights stores product_results organic_results shopping_results inline_shopping_results categorized_shopping_results immersive_products immersive_product_page_token stores_next_page_token').split(' '));
for (const key of ('details_and_offers coupon discount original_price extracted_original_price monthly_payment_duration installments_description down_payment estimated_tax extracted_estimated_tax additional_costs shipping_extracted about_the_product features value').split(' ')) allowed.add(key);
function scrub(value, secret = '') {
  let text = String(value);
  if (secret) text = text.split(secret).join('[REDACTED]');
  text = text.replace(/([?&](?:api_key|access_token|authorization|secret)=)[^&#\s]*/gi, '$1[REDACTED]');
  return text.slice(0, 4000);
}
function project(value, secret, depth = 0) {
  if (depth > 12 || value == null) return null;
  if (typeof value === 'string') return scrub(value, secret);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 60).map(v => project(v, secret, depth + 1));
  if (typeof value !== 'object') return null;
  return Object.fromEntries(Object.entries(value).filter(([k]) => allowed.has(k)).map(([k,v]) => [k,project(v,secret,depth + 1)]));
}
function safeAccount(d) {
  const keys = ['account_status','plan_id','plan_name','plan_monthly_price','plan_renewal_date','searches_per_month','plan_searches_left','extra_credits','total_searches_left','this_month_usage','this_hour_searches','last_hour_searches','account_rate_limit_per_hour'];
  return Object.fromEntries(keys.filter(k => Object.hasOwn(d,k)).map(k => [k,d[k]]));
}
function freeAccount(d) {
  return d.account_status === 'Active' && d.plan_id === 'free' && d.plan_monthly_price === 0 && d.extra_credits === 0 && Number.isFinite(d.total_searches_left) && d.total_searches_left > 0 && typeof d.plan_renewal_date === 'string';
}
function canReserve(state, caseId, now, account) {
  if (!freeAccount(account)) return false;
  if (state.attempts.length >= LIMIT || state.attempts.filter(x => now - x.at < HOUR).length >= LIMIT) return false;
  // First-round cap is deliberately also enforced as a total per-case cap.
  if (state.attempts.filter(x => x.caseId === caseId).length >= 3) return false;
  const hourUsed = Math.max(account.this_hour_searches ?? 0, account.last_hour_searches ?? 0);
  return hourUsed < Math.min(LIMIT, account.account_rate_limit_per_hour ?? 0);
}
function writeState(state) {
  const temp = STATE + '.tmp';
  fs.writeFileSync(temp,JSON.stringify(state,null,2),{mode:0o600});
  fs.renameSync(temp,STATE);
}
function tokens(data) {
  const list = [];
  function visit(v, label = '') {
    if (!v || typeof v !== 'object') return;
    if (v.immersive_product_page_token) list.push({ title:v.title || label, token:v.immersive_product_page_token });
    for (const [k,c] of Object.entries(v)) if (c && typeof c === 'object') visit(c, v.title || label || k);
  }
  visit(data); return list;
}
function candidates(data) {
  const list = [];
  function visit(v) {
    if (!v || typeof v !== 'object') return;
    if ((v.title || v.name) && (v.link || v.product_link || v.price || v.stores)) {
      const { immersive_product_page_token: omitted, ...item } = v;
      void omitted;
      list.push(Object.fromEntries(Object.entries(item).filter(([k,val]) => typeof val !== 'object' || ['extensions','thumbnails','delivery','shipping'].includes(k))));
    }
    for (const c of Object.values(v)) if (c && typeof c === 'object') visit(c);
  }
  visit(data); return list;
}
function preview(data) {
  return candidates(data).slice(0,12).map(v => ({title:v.title || v.name,source:v.source,price:v.price,total:v.total,link:v.link || (v.product_link ? '[Google catalog link in private cache]' : undefined),snippet:v.snippet,hasImage:!!(v.thumbnail || v.image || v.thumbnails?.length),fields:Object.keys(v).filter(k=>!['thumbnail','thumbnails'].includes(k))}));
}
async function main(args) {
  const totalStarted = performance.now();
  const secret = process.env.SERPAPI_API_KEY;
  if (!secret?.trim()) throw new Error('KEY_UNAVAILABLE');
  fs.mkdirSync(DIR,{recursive:true,mode:0o700});
  // A stale lock is never removed automatically. Review it before resuming.
  const lock = fs.openSync(LOCK,'wx',0o600);
  try {
    const readStarted = performance.now();
    const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE,'utf8')) : {version:1,attempts:[],cache:{},accounts:[],cacheHits:[]};
    const stateReadMs = Number((performance.now()-readStarted).toFixed(3));
    if (state.version !== 1 || !Array.isArray(state.attempts)) throw new Error('INVALID_STATE');
    const [command,caseId,engine,query] = args;
    if (command === 'show') {
      const record = state.cache[caseId];
      if (!record) throw new Error('RECORD_NOT_FOUND');
      console.log(JSON.stringify({id:caseId,query:record.query,status:record.status,ms:record.ms,fields:Object.keys(record.data),candidates:candidates(record.data),tokens:tokens(record.data).map((x,i)=>({index:i,title:x.title}))},null,2)); return;
    }
    async function request(engineName, params) {
      const url = new URL(engineName === 'account' ? 'https://serpapi.com/account.json' : 'https://serpapi.com/search.json');
      for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
      url.searchParams.set('api_key',secret);
      const res = await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
      const raw = await res.text();
      if (raw.length > 5000000) throw new Error('BODY_LIMIT');
      return {http:res.status,data:JSON.parse(raw)};
    }
    const a = await request('account',{});
    if (a.http !== 200 || !freeAccount(a.data)) throw new Error('FREE_PLAN_NOT_CONFIRMED');
    const account = safeAccount(a.data); state.accounts.push({at:Date.now(),...account}); writeState(state);
    if (command === 'account') { console.log(JSON.stringify(account)); return; }
    if (!/^[a-z0-9-]{1,40}$/.test(caseId || '')) throw new Error('INVALID_CASE');
    let params;
    if (command === 'search' && ['google','google_shopping'].includes(engine) && query && query.length <= 1000 && !query.includes(secret)) {
      params = {engine,q:query,gl:'br',hl:'pt',google_domain:'google.com.br'};
    } else if (command === 'immersive' || command === 'capture-conditions') {
      const previous = state.cache[engine]; const selected = tokens(previous?.data)[Number(query)];
      if (!selected) throw new Error('TOKEN_NOT_AVAILABLE');
      params = {engine:'google_immersive_product',page_token:selected.token,more_stores:'true'};
    } else throw new Error('INVALID_COMMAND');
    const id = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0,16);
    const cached = state.cache[id];
    // Explicit manual reinspection after extending the field projection. Still
    // reserves an attempt and obeys the case/global limits; never an auto retry.
    if (command === 'capture-conditions' && !cached) throw new Error('EXISTING_RESULT_REQUIRED');
    if (command !== 'capture-conditions' && cached && Date.now() - cached.at < HOUR) {
      const result = {id,cacheHit:true,stateReadMs,recoveryIncludingAccountMs:Math.round(performance.now()-totalStarted),originalMs:cached.ms,candidates:preview(cached.data)};
      state.cacheHits.push({at:Date.now(),id}); writeState(state); console.log(JSON.stringify(result)); return;
    }
    if (!canReserve(state,caseId,Date.now(),account)) throw new Error('BUDGET_BLOCKED');
    const entry = {at:Date.now(),caseId,id,engine:params.engine,query:params.q || 'token-from-existing-result',status:'reserved'};
    state.attempts.push(entry); writeState(state); // Never refund an uncertain request.
    const started = performance.now();
    try {
      const r = await request('search',params);
      const ms = Math.round(performance.now() - started);
      entry.status = r.http === 200 ? 'received' : `http-${r.http}`; entry.ms = ms;
      const data = project(r.data,secret);
      state.cache[id] = {at:Date.now(),query:params.q || 'token-from-existing-result',status:r.http,ms,data}; writeState(state);
      console.log(JSON.stringify({id,caseId,http:r.http,status:r.data.search_metadata?.status || null,hasError:!!r.data.error,ms,attempts:state.attempts.length,fields:Object.keys(data),candidates:preview(data),tokens:tokens(data).map((x,i)=>({index:i,title:x.title}))}));
    } catch {
      entry.status = 'failed-or-uncertain'; entry.ms = Math.round(performance.now()-started); writeState(state);
      throw new Error('REQUEST_FAILED_NO_RETRY');
    }
  } finally { fs.closeSync(lock); fs.unlinkSync(LOCK); }
}
module.exports = {scrub,project,safeAccount,freeAccount,canReserve};
if (require.main === module) main(process.argv.slice(2)).catch(() => {console.error('POC interrompida: configuração, orçamento, lock ou consulta indisponível. Nenhum retry automático; detalhes sensíveis omitidos.');process.exitCode=1;});
