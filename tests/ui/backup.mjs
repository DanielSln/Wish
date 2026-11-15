// Uses a deliberately reserved test hostname and a simulated backend, never real credentials.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { MemoryServer, ownerA, ownerB, backend } from '../helpers/sync-fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.WISH_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.WISH_CHROMIUM_PATH?{executablePath:process.env.WISH_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:412,height:915}});page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const server=new MemoryServer();const signal=new AbortController().signal;let account=ownerA;
 await page.route(backend+'/**',async route=>{
  const req=route.request();const payload=req.postDataJSON();const path=new URL(req.url()).pathname;let out=null;
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'}});return;}
  if(path==='/auth/v1/verify'){account=payload.email.startsWith('b@')?ownerB:ownerA;out={access_token:'test-access-token-for-'+account,refresh_token:'test-refresh-token',expires_at:9999999999,user:{id:account,email:payload.email}};}
  if(path==='/rest/v1/rpc/wish_sync_pull')out=await server.remote(account).pull(payload.p_cursor,payload.p_upper,signal);
  if(path==='/rest/v1/rpc/wish_sync_push')out=await server.remote(account).push({op_id:payload.p_op_id,kind:payload.p_kind,id:payload.p_id,base_version:payload.p_base_version,data:payload.p_payload},signal);
  await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(out)});
 });
 page.on('console',m=>{if(m.type()==='error')console.log('browser error',m.text())});
 const tab=name=>page.getByRole('tab',{name:new RegExp(name)});await page.goto(process.env.WISH_TEST_URL||'http://localhost:8091',{timeout:120000});await tab('Adicionar').click({timeout:120000});await page.getByLabel('Nome para começar').fill('Desejo antes do login');await page.getByRole('button',{name:'Continuar com esse nome',exact:true}).click();await page.getByRole('button',{name:'Salvar desejo',exact:true}).click();await page.getByRole('button',{name:'Voltar à lista',exact:true}).click();
 async function login(email){await tab('Configurações').click();await page.getByRole('button',{name:'Ativar backup',exact:true}).click();await page.getByLabel('E-mail para backup').fill(email);await page.getByRole('button',{name:'Enviar código',exact:true}).click();await page.getByLabel('Código recebido por e-mail').fill('123456');await page.getByRole('button',{name:'Confirmar código',exact:true}).click();await page.getByRole('button',{name:'Confirmar código',exact:true}).waitFor({state:'hidden'});await tab('Configurações').click();await page.getByText(email,{exact:true}).waitFor();}
 await login('a@example.test');await page.getByText('Associar este catálogo?',{exact:true}).waitFor();assert.equal(server.pushCalls,0);await page.getByRole('button',{name:'Confirmar associação e iniciar backup',exact:true}).click();await tab('Configurações').click();await page.getByText('Sincronizado',{exact:true}).waitFor();assert.equal([...server.account(ownerA).records.values()].filter(r=>r.kind==='product').length,1);assert.ok(await page.getByText(/Último backup concluído:/).count());
 await page.reload();await page.getByText('a@example.test',{exact:true}).waitFor();await page.getByRole('button',{name:'Sair da conta',exact:true}).click();await tab('Início').click();await page.getByText('Sua lista, no seu ritmo.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Ver Desejo antes do login',exact:true}).count(),0);
 await login('b@example.test');await page.getByText('Associar este catálogo?',{exact:true}).waitFor();await page.getByRole('button',{name:'Confirmar associação e iniciar backup',exact:true}).click();await tab('Configurações').click();await page.getByText('Sincronizado',{exact:true}).waitFor();assert.equal([...server.account(ownerB).records.values()].filter(r=>r.kind==='product').length,0);await page.getByRole('button',{name:'Sair da conta',exact:true}).click();
 await login('a@example.test');await page.getByRole('button',{name:'Sincronizar agora',exact:true}).waitFor();await tab('Início').click();await page.getByRole('button',{name:'Ver Desejo antes do login',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'passed',backend:'simulated',checks:['guest catalog','OTP form','explicit consent before uploads','confirmed backup','reload session','logout isolated catalog','second account isolation','return to first preserved catalog'],pageErrors:errors}));
}finally{await browser.close()}
