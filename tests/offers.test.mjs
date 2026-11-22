import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../src/data/migrations.ts';
import {createRepository} from '../src/data/repository.ts';
import {copyVerifiedDatabase} from '../src/data/database-snapshot.ts';
import {orderedOffers,validateOffer} from '../src/domain/offers.ts';
import {palettes} from '../src/theme/palette.ts';
const rawFor=new WeakMap();
function adapter(raw){const db={
 async execAsync(sql){raw.exec(sql)},async runAsync(sql,...args){return raw.prepare(sql).run(...args)},async getFirstAsync(sql,...args){return raw.prepare(sql).get(...args)??null},async getAllAsync(sql,...args){return raw.prepare(sql).all(...args)},
 async withTransactionAsync(fn){raw.exec('BEGIN');try{await fn();raw.exec('COMMIT')}catch(e){raw.exec('ROLLBACK');throw e}}
};rawFor.set(db,raw);return db;}
const product=category_id=>({name:'Headset variante exata',description:'Modelo 1',category_id,priority:'high',image_url:'',price_cents:79990,desired_price_cents:39990,store:'Fonte anterior',original_url:'https://example.com/item?variant=1',notes:'Legado',personal_notes:'Nota pessoal',offer_details:'PIX e cupom não verificados',status:'pending'});
const offer=(price_cents=34990)=>({store:'Loja A',price_cents,url:'https://example.com/item?variant=1&ref=preservado',condition:'Novo; unidade; variante 1',conditional:0});
async function seed(raw){const db=adapter(raw);await migrate(db);const repo=createRepository(db,randomUUID);const id=await repo.save(product((await repo.categories())[0].id));return{db,repo,id};}
function asV4(raw){raw.exec('DROP TABLE product_offers; PRAGMA user_version=4');}
test('v4 requires a successful snapshot; backup or migration failure leaves original rows/version intact',async()=>{
 const raw=new DatabaseSync(':memory:');try{const{db,repo,id}=await seed(raw);asV4(raw);const original=await repo.get(id);
 await assert.rejects(migrate(db),/Backup obrigatório/);await assert.rejects(migrate(db,async()=>{throw Error('backup full')}),/backup full/);assert.equal(raw.prepare('PRAGMA user_version').get().user_version,4);
 const failure={...db,execAsync:async sql=>{if(sql.includes('PRAGMA user_version = 5'))throw Error('disk full');return db.execAsync(sql)}};
 await assert.rejects(migrate(failure,async()=>'snapshot.db'),/disk full/);assert.equal(raw.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='product_offers'").get().n,0);assert.equal(raw.prepare('PRAGMA user_version').get().user_version,4);assert.deepEqual(await repo.get(id),original);
 let copies=0;await migrate(db,async()=>{copies++;return 'snapshot.db'});await migrate(db,async()=>{copies++;return 'other.db'});assert.equal(copies,1);assert.deepEqual(await repo.get(id),original);assert.equal((await repo.offers(id)).length,0);assert.equal(raw.prepare('PRAGMA user_version').get().user_version,5);
 assert.equal(raw.prepare("SELECT value FROM app_settings WHERE key='pre_v5_backup_name'").get().value,'snapshot.db');
 }finally{raw.close()}
});
test('SQLite online backup and recovery copy preserve a real WAL catalogue without replacing live database',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wish-offer-snapshot-'));const raw=new DatabaseSync(join(dir,'live.db'));
 try{const{db,repo,id}=await seed(raw);asV4(raw);const original=await repo.get(id);const paths=new WeakMap();
 const driver={async open(name){const path=join(dir,name);const database=adapter(new DatabaseSync(path));paths.set(database,path);return database},async copy(source,destination){await backup(rawFor.get(source),paths.get(destination))},async close(database){rawFor.get(database).close()}};
 await migrate(db,()=>copyVerifiedDatabase(db,driver,'pre-v5.db'));await repo.savePersonalNotes(id,'Mudança posterior');
 const snapshot=adapter(new DatabaseSync(join(dir,'pre-v5.db')));try{assert.equal((await snapshot.getFirstAsync('PRAGMA user_version')).user_version,4);assert.deepEqual(await createRepository(snapshot,randomUUID).get(id),original);await copyVerifiedDatabase(snapshot,driver,'recovery.db');}finally{rawFor.get(snapshot).close()}
 const recovery=new DatabaseSync(join(dir,'recovery.db'));try{assert.equal(recovery.prepare('SELECT personal_notes FROM products WHERE id=?').get(id).personal_notes,original.personal_notes)}finally{recovery.close()}
 assert.equal((await repo.get(id)).personal_notes,'Mudança posterior');await assert.rejects(copyVerifiedDatabase(db,driver,'pre-v5.db'),/já contém dados/);
 }finally{raw.close();rmSync(dir,{recursive:true,force:true})}
});
test('manual offers sort by cents, preserve exact links and product fields, isolate identities and persist after reopen',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wish-offers-')),path=join(dir,'live.db');let raw=new DatabaseSync(path);
 try{let{repo,id}=await seed(raw);const original=await repo.get(id);const other=await repo.save({...product(original.category_id),name:original.name+' similar'});
 await repo.saveOffer(id,offer(39990));await repo.saveOffer(id,{...offer(34990),store:'Loja B'});await repo.saveOffer(id,{...offer(29990),store:'PIX',conditional:1,condition:'Somente PIX'});
 let rows=await repo.offers(id);assert.deepEqual(orderedOffers(rows).map(o=>o.price_cents),[29990,34990,39990]);assert.deepEqual(orderedOffers(rows).filter(o=>!o.conditional).map(o=>o.price_cents),[34990,39990]);assert.deepEqual(await repo.offers(other),[]);assert.deepEqual(await repo.get(id),original);assert.equal(rows[0].url,offer().url);assert.match(rows[0].recorded_at,/^\d{4}-/);
 const changed=rows[1];await repo.saveOffer(id,offer(32990),changed.id);await assert.rejects(repo.saveOffer(other,offer(),changed.id),/não disponível/);assert.equal((await repo.offers(id)).find(o=>o.id===changed.id).price_cents,32990);
 raw.close();raw=new DatabaseSync(path);repo=createRepository(adapter(raw),randomUUID);assert.equal((await repo.offers(id)).length,3);await repo.removeOffer(id,changed.id);assert.equal((await repo.offers(id)).length,2);assert.ok(raw.prepare('SELECT deleted_at FROM product_offers WHERE id=?').get(changed.id).deleted_at);assert.deepEqual(await repo.get(id),original);
 await repo.remove(id);assert.deepEqual(await repo.offers(id),[]);await assert.rejects(repo.saveOffer(id,offer()),/não disponível/);
 }finally{raw.close();rmSync(dir,{recursive:true,force:true})}
});
test('offer validation refuses missing/invalid prices and unsafe links without modifying existing rows',()=>{
 for(const value of [0,-1,null,NaN,Infinity,1.1,100000000000])assert.throws(()=>validateOffer({...offer(),price_cents:value}));
 for(const url of ['http://example.com','https://localhost/item','https://127.0.0.1/item','https://user:pass@example.com/x','javascript:alert(1)','file:///x','https://example.com:8443/x'])assert.throws(()=>validateOffer({...offer(),url}));
 assert.throws(()=>validateOffer({...offer(),store:' '}));assert.throws(()=>validateOffer({...offer(),conditional:1,condition:''}));assert.doesNotThrow(()=>validateOffer(offer()));
 assert.deepEqual(orderedOffers([{...offer(-1),id:'bad'},{...offer(39990),id:'deleted',deleted_at:'date'}]),[]);
});
test('priority text colours meet 4.5:1 on card and soft backgrounds in both themes',()=>{
 const luminance=hex=>{const channels=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722};
 for(const palette of Object.values(palettes))for(const key of ['priorityHigh','priorityMedium','priorityLow'])for(const bg of [palette.card,palette.bg,palette.soft]){const a=luminance(palette[key]),b=luminance(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${key} on ${bg}`)}
});
