import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personalRuntime,device,enroll,signed,proof} from './personal-harness.mjs';
import {runtime,identify,compare} from './harness.mjs';
const checked=async(p,status)=>{const r=await p;assert.equal(r.status,status,'Unexpected HTTP status; confidential payload omitted');return r;};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup(t,options={}){const r=await personalRuntime(options);t.after(async()=>{assert.equal(r.outbound(),0);await r.close();});return r;}
async function ready(t,opts={}){const r=await setup(t,opts),d=await device(),s=await enroll(r,d);return {r,d,s};}
async function peek(r,predicate=x=>x.stats.calls===1){for(let i=0;i<50;i++){const p=await checked(r.admin('test',{action:'peek'}),200);if(predicate(p.data))return p.data;await pause(5);}throw Error('Controlled mock did not reach expected stage');}
const stats=async r=>(await checked(r.admin('status'),200)).data;
test('signed preissued cancel interrupts gated mock, retains reservation and confirms only after fence',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),body=compare('interrupt'),cancel={requestId:'interrupt'};
 const cp=await proof(r,d,s,'/v1/cancel',cancel),qp=await proof(r,d,s,'/v1/compare',body);
 const query=r.post('/v1/compare',body,qp.headers);await peek(r);
 const result=await checked(r.post('/v1/cancel',cancel,cp.headers),200);assert.equal(result.data.cancelled,true);await checked(query,409);
 const state=await stats(r);assert.equal(state.calls,1);assert.equal(state.reserved,1);assert.equal(state.uncertain,1);assert.equal(state.pending,0);
 await checked(r.post('/v1/cancel',cancel,cp.headers),401);
});
test('urgent revocation interrupts active comparison, suppresses result and prevents second provider call',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),body=compare('revoke-live');const qp=await proof(r,d,s,'/v1/compare',body);
 const query=r.post('/v1/compare',body,qp.headers);await peek(r);
 await checked(r.admin('revoke',{deviceId:s.deviceId}),200);const denied=await checked(query,401);assert.equal(denied.data.assessment,undefined);
 const state=await stats(r);assert.equal(state.calls,1);assert.equal(state.reserved,1);assert.equal(state.uncertain,1);
 await checked(signed(r,d,s,'/auth/renew',{}),401);
});
test('revocation takes priority over already queued searches without creating more reservations',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),first=identify('busy'),second=identify('queued','Other product');
 const p1=await proof(r,d,s,'/v1/identify',first),p2=await proof(r,d,s,'/v1/identify',second);
 const q1=r.post('/v1/identify',first,p1.headers);await peek(r);const q2=r.post('/v1/identify',second,p2.headers);await peek(r,x=>x.waiting===1);
 await checked(r.admin('revoke',{deviceId:s.deviceId}),200);await checked(q1,401);await checked(q2,401);assert.equal((await stats(r)).reserved,1);
});
test('invalid operator capability cannot interrupt a running search',async t=>{
 const {r,d,s}=await ready(t,{gate:true});const query=signed(r,d,s,'/v1/identify',identify('invalid-root'));await peek(r);
 await checked(r.admin('revoke',{deviceId:s.deviceId},'0'.repeat(64)),401);assert.equal((await peek(r)).active.cancelled,false);
 await checked(r.admin('test',{action:'release'}),200);await checked(query,200);assert.equal((await stats(r)).uncertain,0);
});
test('forged cancellation proof cannot set restrictive interrupt state',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),wrong=await device(),cancel={requestId:'wrong-proof'};
 const bad=await proof(r,wrong,s,'/v1/cancel',cancel),qp=await proof(r,d,s,'/v1/identify',identify('wrong-proof'));
 const query=r.post('/v1/identify',identify('wrong-proof'),qp.headers);await peek(r);
 await checked(r.post('/v1/cancel',cancel,bad.headers),401);assert.equal((await peek(r)).active.cancelled,false);
 await r.admin('test',{action:'release'});await checked(query,200);assert.equal((await stats(r)).calls,1);
});
test('one device cannot interrupt a different device using the shared personal owner',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),other=await device(),s2=await enroll(r,other),body=identify('foreign'),cancel={requestId:'foreign'};
 const cp=await proof(r,other,s2,'/v1/cancel',cancel),qp=await proof(r,d,s,'/v1/identify',body);
 const query=r.post('/v1/identify',body,qp.headers);await peek(r);const cancellation=r.post('/v1/cancel',cancel,cp.headers);
 await pause(30);assert.equal((await peek(r)).active.cancelled,false);await r.admin('test',{action:'release'});await checked(query,200);
 const result=await checked(cancellation,200);assert.equal(result.data.cancelled,false);assert.equal((await stats(r)).calls,1);
});
test('duplicate concurrent cancellation signatures never authorize a second control operation',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),body=identify('same-control'),cancel={requestId:'same-control'};
 const cp=await proof(r,d,s,'/v1/cancel',cancel),qp=await proof(r,d,s,'/v1/identify',body);
 const query=r.post('/v1/identify',body,qp.headers);await peek(r);
 const results=await Promise.all([r.post('/v1/cancel',cancel,cp.headers),r.post('/v1/cancel',cancel,cp.headers)]);
 assert.equal(results.filter(x=>x.status===200).length,1);assert.ok(results.every(x=>[200,401,429].includes(x.status)));await checked(query,409);assert.equal((await stats(r)).reserved,1);
});
for(const controls of [false,'omit'])test('test fixtures denied when binding '+String(controls),async t=>{
 const {r,d,s}=await ready(t,{testControls:controls});await checked(r.admin('test',{action:'peek'}),400);await checked(r.admin('test',{action:'fault'}),400);
 await checked(signed(r,d,s,'/v1/identify',identify('no-fixtures')),200);assert.equal((await stats(r)).calls,1);
});
test('legacy test controls are also opt-in, not implied by local-only execution',async t=>{
 const r=await runtime({testControls:false});t.after(()=>r.close());await checked(r.control('stats'),400);await checked(r.call(identify()),200);
});
test('public ingress strips admin authority and refuses private fixture and operator endpoints',async t=>{
 const {r}=await ready(t);for(const path of ['/operator/test','/operator/revoke','/__test','/__egress-probe'])await checked(r.post(path,{action:'release',deviceId:'not-a-device'},{'x-operator':r.context.operator,'x-internal':r.internal}),400);
 assert.equal((await stats(r)).calls,0);
});
test('late witness acknowledgement causes timeout and permanent mismatch, not retry',async t=>{
 const r=await setup(t,{witnessTimeoutMs:200});r.fault.delayAckMs=350;await checked(r.admin('status'),503);await pause(400);r.fault.delayAckMs=0;
 await checked(r.admin('status'),503);assert.equal((await checked(r.admin('test',{action:'peek'}),200)).data.stats.calls,0);
});
test('oversized witness response fails closed and cannot synchronize from an untrusted reply',async t=>{
 const r=await setup(t);r.fault.oversized=true;await checked(r.admin('status'),503);r.fault.oversized=false;await checked(r.admin('recover',{recoveryToken:r.context.recovery}),503);
 assert.equal((await checked(r.admin('test',{action:'peek'}),200)).data.stats.calls,0);
});
test('valid session expiring while mock is in flight cannot receive a late result',async t=>{
 const {r,d,s}=await ready(t,{gate:true,sessionMs:1200});const query=signed(r,d,s,'/v1/identify',identify('expires-inflight'));await peek(r);await pause(1250);await r.admin('test',{action:'release'});
 const out=await checked(query,401);assert.equal(out.data.assessment,undefined);assert.equal((await stats(r)).reserved,1);
});
test('revocation persists after interrupt and actual runtime restart',async t=>{
 const r=await personalRuntime({gate:true}),d=await device(),s=await enroll(r,d);const query=signed(r,d,s,'/v1/identify',identify('restart-revoke'));await peek(r);await checked(r.admin('revoke',{deviceId:s.deviceId}),200);await checked(query,401);await r.close();
 const next=await setup(t,{context:r.context,persist:r.persist});await checked(signed(next,d,s,'/v1/identify',identify('after-restart')),401);assert.equal((await stats(next)).reserved,1);
});
test('absence of an independent restore proof stays blocking regardless of operator authority',async t=>{
 const r=await setup(t,{restored:true});await checked(r.admin('recover',{recoveryToken:r.context.recovery}),503);await checked(r.admin('reconcile'),503);
});
test('control lane remains available when ordinary admission slots are full',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),bodies=Array.from({length:16},(_,i)=>identify('saturated-'+i,'Product '+i));
 const proofs=[];for(const body of bodies)proofs.push(await proof(r,d,s,'/v1/identify',body));
 const first=r.post('/v1/identify',bodies[0],proofs[0].headers);await peek(r);
 const waiting=bodies.slice(1).map((body,i)=>r.post('/v1/identify',body,proofs[i+1].headers));await peek(r,x=>x.waiting===15);
 await checked(r.admin('revoke',{deviceId:s.deviceId}),200);await checked(first,401);const outcomes=await Promise.all(waiting);assert.ok(outcomes.every(x=>x.status===401));assert.equal((await stats(r)).reserved,1);
});
test('revocation arriving during end-fence acknowledgement still suppresses the completed response',async t=>{
 const {r,d,s}=await ready(t,{gate:true}),body=identify('late-revoke'),qp=await proof(r,d,s,'/v1/identify',body);
 t.after(()=>r.fault.releaseAck());
 const query=r.post('/v1/identify',body,qp.headers);await peek(r);r.fault.holdNextAck=true;await r.admin('test',{action:'release'});
 for(let i=0;i<100&&!r.fault.ackHeld;i++)await pause(5);assert.equal(r.fault.ackHeld,true);
 const revocation=r.admin('revoke',{deviceId:s.deviceId});await peek(r,x=>x.active?.cancelled===true);r.fault.releaseAck();
 await checked(revocation,200);const out=await checked(query,401);assert.equal(out.data.assessment,undefined);assert.equal((await stats(r)).calls,1);
});
test('witness failure during urgent revocation never acknowledges durable revocation or returns product data',async t=>{
 const {r,d,s}=await ready(t,{gate:true});const query=signed(r,d,s,'/v1/identify',identify('failed-revoke'));await peek(r);r.fault.down=true;
 await checked(r.admin('revoke',{deviceId:s.deviceId}),503);const out=await checked(query,503);assert.equal(out.data.assessment,undefined);r.fault.down=false;
 await checked(r.admin('status'),503);assert.equal((await checked(r.admin('test',{action:'peek'}),200)).data.stats.calls,1);
});
test('invented cycle rollover cannot create a new budget or clear reservations',async t=>{
 const r=await runtime();t.after(()=>r.close());await checked(r.call(identify('before-rollover')),200);
 const before=(await checked(r.control('stats'),200)).data;await checked(r.control('snapshot',{...r.snapshot,cycleId:'mock-invented-cycle',observedAt:Date.now()}),503);
 await checked(r.call(identify('after-rollover','Another product')),503);const after=(await checked(r.control('stats'),200)).data;assert.equal(after.blocked,true);assert.equal(after.reserved,before.reserved);assert.equal(after.calls,before.calls);
});
test('exposure inventory rejects deployment and verifies every current blocker marker',async()=>{
 const {spawnSync}=await import('node:child_process');const run=spawnSync(process.execPath,['experiments/cloudflare-gateway/exposure-audit.mjs'],{encoding:'utf8'});
 assert.equal(run.status,1);const report=JSON.parse(run.stdout);assert.equal(report.decision,'NO_GO');assert.equal(report.deploymentAllowed,false);assert.deepEqual(report.missingEvidence,[]);assert.equal(report.verified.length,11);
});
test('failed ordinary signatures still consume the persistent proof rate limit inside the fence',async t=>{
 const {r,s}=await ready(t),wrong=await device(),body=identify('invalid-proof-rate'),bad=await proof(r,wrong,s,'/v1/identify',body);
 for(let i=0;i<20;i++)await checked(r.post('/v1/identify',body,bad.headers),401);
 await checked(r.post('/v1/identify',body,bad.headers),429);assert.equal((await stats(r)).reserved,0);
});
