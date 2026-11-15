import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
// Optional PostgreSQL WASM runner, installed outside the app. See docs/SUPABASE-SETUP.md.
const modulePath=process.env.WISH_PGLITE_MODULE;
test('PostgreSQL migration, RPC protocol and RLS isolate accounts (local engine, not real Supabase)',{skip:!modulePath},async()=>{
 const {PGlite}=await import(modulePath);const db=new PGlite();
 const A=randomUUID(),B=randomUUID(),cid=randomUUID(),pid=randomUUID();
 const date='2026-11-15T00:00:00.000Z';const category={id:cid,name:'Tecnologia',created_at:date,updated_at:date,deleted_at:null};
 async function user(id,role='authenticated'){await db.exec(`RESET ROLE; SET ROLE ${role};`);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);}
 async function push(data,kind='category',base=0,op=randomUUID()){return (await db.query('SELECT public.wish_sync_push($1,$2,$3,$4,$5::jsonb) AS result',[op,kind,data.id,base,JSON.stringify(data)])).rows[0].result;}
 async function pull(cursor=0,upper=null,limit=100){return (await db.query('SELECT public.wish_sync_pull($1,$2,$3) AS result',[cursor,upper,limit])).rows[0].result;}
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  try{await db.exec(readFileSync(new URL('../supabase/migrations/202611150001_wish_backup.sql',import.meta.url),'utf8'))}catch(e){throw new Error(`Migration: ${e.message} at ${e.position}`)}
  await db.query('INSERT INTO auth.users VALUES($1),($2)',[A,B]);await user(A);
  const op=randomUUID();const first=await push({...category,user_id:B},'category',0,op);assert.equal(first.status,'ok');assert.equal(first.record.version,1);
  assert.deepEqual(await push({...category,user_id:B},'category',0,op),first);await assert.rejects(push({...category,name:'Changed'},'category',0,op),/reused/);
  assert.equal((await db.query('SELECT user_id FROM public.wish_categories')).rows[0].user_id,A);
  await assert.rejects(db.query('UPDATE public.wish_categories SET name=$1',['Bypass']),/permission denied/);
  await assert.rejects(db.query('SELECT public.wish_sync_record($1,$2,$3)',[B,'category',cid]),/permission denied/);
  const conflict=await push({...category,name:'Other'},'category',0);assert.equal(conflict.status,'conflict');assert.equal(conflict.record.data.name,'Tecnologia');
  const product={id:pid,name:'Notebook',description:'',category_id:cid,priority:'medium',image_url:'',price_cents:null,desired_price_cents:null,store:'',original_url:'',notes:'',status:'pending',created_at:date,updated_at:date,deleted_at:null};
  assert.equal((await push(product,'product')).status,'ok');assert.equal((await push({...category,deleted_at:date},'category',1)).status,'category_in_use');
  const page=await pull(0,null,1);assert.equal(page.more,true);assert.equal(page.upper,2);assert.equal(page.items.length,1);
  assert.equal((await push({...product,notes:'v2'},'product',1)).status,'ok');const page2=await pull(page.cursor,page.upper,1);assert.equal(page2.more,false);assert.equal(page2.cursor,2);assert.equal((await pull(page2.cursor)).items.length,1);
  const head=(await pull()).upper;await assert.rejects(push({...product,id:randomUUID(),price_cents:1.5},'product'),/integer/);assert.equal((await pull()).upper,head);
  await user(B);assert.equal((await db.query('SELECT * FROM public.wish_products')).rows.length,0);assert.equal((await pull()).items.length,0);await assert.rejects(push({...product,id:randomUUID()},'product'),/same account/);
  assert.equal((await push({...category,name:'B category'})).status,'ok');assert.equal((await db.query('SELECT user_id FROM public.wish_categories')).rows[0].user_id,B);
  await user(A);assert.equal((await db.query('SELECT name FROM public.wish_categories')).rows[0].name,'Tecnologia');assert.equal((await push({...product,deleted_at:date},'product',2)).status,'ok');assert.equal((await push({...category,deleted_at:date},'category',1)).status,'ok');
  await user('', 'anon');await assert.rejects(pull(),/permission denied/);await assert.rejects(db.query('SELECT * FROM public.wish_products'),/permission denied/);
  await user('');await assert.rejects(pull(),/Authentication required/);
 }finally{await db.close()}
});
