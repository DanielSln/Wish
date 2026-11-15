import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chunkedSecretStore } from '../src/auth/secret-store.ts';
import { backendConfig } from '../src/auth/config.ts';
import { BackendHttp } from '../src/auth/http.ts';
import { AuthService } from '../src/auth/service.ts';
import { supabaseRemote } from '../src/sync/remote.ts';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const config={url:'https://wish-test.example',key:'sb_publishable_testfixture'};
const session=(id=A,expiry=9999999999)=>({access_token:'test-access-token-long-enough',refresh_token:'test-refresh-token',expires_at:expiry,user:{id,email:id===A?'a@example.test':'b@example.test'}});
function setup(handler,stored=null){let value=stored;const storage={get:async()=>value,set:async v=>{value=v},clear:async()=>{value=null}};const requests=[];const http=new BackendHttp(config,async(url,init)=>{requests.push({url,init});const out=await handler(url,JSON.parse(init.body||'null'),init);return out instanceof Response?out:Response.json(out)});return {auth:new AuthService(http,storage,()=>1000000),storage,requests,value:()=>value};}
test('configuration is optional and rejects secrets or unsafe origins',()=>{
 assert.equal(backendConfig('',''),null);assert.deepEqual(backendConfig(config.url,config.key),config);
 for(const url of ['http://example.test','https://user:pass@example.test','https://example.test/path','https://example.test?x=y'])assert.throws(()=>backendConfig(url,config.key));
 for(const key of ['sb_secret_test','wrong',btoa('{}')+'.'+btoa(JSON.stringify({role:'service_role'}))+'.x'])assert.throws(()=>backendConfig(config.url,key));
});
test('secure chunks commit atomically, tolerate partial writes, and logout invalidates the manifest',async()=>{
 const map=new Map();let fail=false;const backend={get:async k=>map.get(k)??null,set:async(k,v)=>{if(fail&&k.endsWith('.1'))throw Error('locked');assert.ok(Buffer.byteLength(v)<=2048);map.set(k,v)},remove:async k=>{map.delete(k)}};
 const storage=chunkedSecretStore(backend,'test',randomUUID);await storage.set('old');fail=true;await assert.rejects(storage.set('💙'.repeat(1200)));assert.equal(await storage.get(),'old');fail=false;await storage.set('💙'.repeat(1200));assert.equal(await storage.get(),'💙'.repeat(1200));await storage.clear();assert.equal(await storage.get(),null);
 map.set('test.manifest','broken');await assert.rejects(storage.get());await storage.clear();assert.equal(await storage.get(),null);
});
test('OTP persists securely before login; startup restores without network and account switching needs logout',async()=>{
 const f=setup(async url=>url.includes('/verify')?session():null);await f.auth.restore();assert.equal(f.requests.length,0);await f.auth.sendCode(' A@example.test ');assert.deepEqual(JSON.parse(f.requests[0].init.body),{email:'a@example.test',create_user:true});await f.auth.verifyCode('a@example.test','123456');assert.equal(f.auth.identity,A);assert.equal(JSON.parse(f.value()).user.id,A);await assert.rejects(f.auth.sendCode('b@example.test'),/Saia/);await assert.rejects(f.auth.tokenFor(B));const g=setup(()=>{throw Error('must not fetch')},f.value());await g.auth.restore();assert.equal(g.auth.identity,A);assert.equal(g.requests.length,0);
});
test('failed protected write never reports authenticated; malformed or wrong-user OTP is rejected',async()=>{
 const f=setup(()=>session());await f.auth.restore();f.storage.set=async()=>{throw Error('locked')};await assert.rejects(f.auth.verifyCode('a@example.test','123456'),/proteger/);assert.equal(f.auth.identity,null);await assert.rejects(f.auth.verifyCode('a@example.test','bad'),/numérico/);
 const g=setup(()=>session(B));await g.auth.restore();await assert.rejects(g.auth.verifyCode('a@example.test','123456'),/corresponde/);assert.equal(g.auth.identity,null);
});
test('refresh is single-flight, rotates secure session and rejects a different identity',async()=>{
 const f=setup(()=>session(A,2000),JSON.stringify(session(A,900)));await f.auth.restore();assert.deepEqual(await Promise.all([f.auth.tokenFor(A),f.auth.tokenFor(A)]),[session().access_token,session().access_token]);assert.equal(f.requests.length,1);assert.equal(JSON.parse(f.value()).expires_at,2000);
 const g=setup(()=>session(B),JSON.stringify(session(A,900)));await g.auth.restore();await assert.rejects(g.auth.tokenFor(A),/outra conta/);assert.equal(g.auth.snapshot.needsReauth,true);assert.equal(g.auth.identity,A);
});
test('expired session pauses backup on rejection; network failures keep offline account usable',async()=>{
 const f=setup(()=>new Response('{}',{status:401}),JSON.stringify(session(A,900)));await f.auth.restore();await assert.rejects(f.auth.tokenFor(A));assert.equal(f.auth.snapshot.needsReauth,true);assert.equal(f.auth.identity,A);
 const g=setup(()=>{throw Error('offline')},JSON.stringify(session(A,900)));await g.auth.restore();await assert.rejects(g.auth.tokenFor(A),/Sem conexão/);assert.equal(g.auth.snapshot.needsReauth,false);assert.equal(g.auth.identity,A);
});
test('logout clears device credentials offline; protected-storage failure blocks a new login',async()=>{
 const f=setup(()=>{throw Error('offline')},JSON.stringify(session()));await f.auth.restore();assert.equal(await f.auth.signOut(),true);assert.equal(f.value(),null);assert.equal(f.auth.identity,null);assert.match(f.auth.snapshot.error,/revogação/);
 const g=setup(()=>null,JSON.stringify(session()));await g.auth.restore();g.storage.clear=async()=>{throw Error('locked')};assert.equal(await g.auth.signOut(),false);assert.equal(g.auth.snapshot.logoutFailed,true);await assert.rejects(g.auth.sendCode('b@example.test'),/saída/);
});
test('logout cancels an in-flight refresh and cannot resurrect the session',async()=>{
 let release;const gate=new Promise(r=>{release=r});const f=setup(async url=>{if(url.includes('/token'))await gate;return url.includes('/token')?session():null},JSON.stringify(session(A,900)));await f.auth.restore();const refreshing=f.auth.tokenFor(A);await new Promise(r=>setImmediate(r));await f.auth.signOut();release();await assert.rejects(refreshing,/interrompida/);assert.equal(f.auth.identity,null);assert.equal(f.value(),null);
});
test('HTTP refuses redirects/oversized responses and preserves rate-limit backoff',async()=>{
 for(const response of [new Response('',{status:302}),new Response('{}',{headers:{'content-length':'8000001'}})]){const h=new BackendHttp(config,async()=>response);await assert.rejects(h.call('/test',{}),e=>e.code==='invalid');}
 const h=new BackendHttp(config,async()=>new Response('{}',{status:429,headers:{'Retry-After':'45'}}));await assert.rejects(h.call('/test',{}),e=>e.code==='network'&&e.retryAfterMs===45000);
});

test('RPC authentication rejection after refresh requests reauthentication without switching catalogs',async()=>{
 const f=setup(url=>url.includes('/token')?session():new Response('{}',{status:401}),JSON.stringify(session()));await f.auth.restore();const remote=supabaseRemote(f.auth.http,f.auth,A);await assert.rejects(remote.pull(0,null,new AbortController().signal),e=>e.code==='auth');assert.equal(f.auth.snapshot.needsReauth,true);assert.equal(f.auth.identity,A);assert.equal(f.requests.length,3);
});

test('HTTP invokes the fetch adapter without a foreign receiver (browser fetch compatibility)',async()=>{
 const h=new BackendHttp(config,async function(){assert.equal(this,undefined);return Response.json(null)});assert.equal(await h.call('/auth/v1/otp',{}),null);
});
