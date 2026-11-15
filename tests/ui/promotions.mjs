// Browser-only regression with synthetic product/prices, not a live-store test.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {kabumPage,kabumSource} from '../fixtures/kabum-public-pricing.mjs';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.WISH_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.WISH_CHROMIUM_PATH?{executablePath:process.env.WISH_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:412,height:915}});page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Campaign timestamps are relative for UI; unit tests use a fixed clock.
 const html=kabumPage({product:{offer:{startDate:Date.now()/1000-3600,endDate:Date.now()/1000+3600,login:false}}});
 await page.route(kabumSource,r=>r.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:html}));
 const tab=name=>page.getByRole('tab',{name:new RegExp(name)});await page.goto(process.env.WISH_TEST_URL||'http://localhost:8093',{timeout:120000});await tab('Adicionar').click({timeout:120000});
 await page.getByText('O próximo desejo.',{exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('[dir="auto"]')).some(e=>e.textContent==='Wish'&&e.getBoundingClientRect().width>0)));
 const scroll=await page.evaluate(()=>{const e=Array.from(document.querySelectorAll('*')).find(e=>e.getBoundingClientRect().height>0&&['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+50);if(!e)return null;e.scrollTop=80;return{moved:e.scrollTop>0,indicator:getComputedStyle(e).scrollbarWidth}});assert.ok(scroll?.moved);assert.equal(scroll.indicator,'none');
 await page.getByRole('textbox',{name:'Link do produto para começar',exact:true}).fill(kabumSource);await page.getByRole('button',{name:'Adicionar por link',exact:true}).click();await page.getByText('Prévia do produto',{exact:true}).waitFor();
 await page.getByText(/Preço informado pela página:.*100,00/).waitFor();const original=page.getByLabel(/^Preço anterior informado:/);assert.match(await original.innerText(),/150,00/);assert.match(await original.evaluate(e=>getComputedStyle(e).textDecorationLine),/line-through/);
 await page.getByText('Cupom anunciado: TESTE15',{exact:true}).waitFor();await page.getByText(/Nenhum cupom foi aplicado/).waitFor();await page.getByRole('button',{name:'Revisar usando o preço PIX',exact:true}).click();const input=page.getByRole('textbox',{name:'Preço conhecido',exact:true});await input.waitFor();assert.equal(await input.inputValue(),'80,00');
 // A user-confirmed manual coupon price remains editable and is not calculated by the importer.
 await input.fill('75,00');await page.getByRole('button',{name:'Mais detalhes e categorias',exact:true}).click();assert.match(await page.getByRole('textbox',{name:'Anotações pessoais',exact:true}).inputValue(),/TESTE15/);await page.getByRole('button',{name:'Salvar desejo',exact:true}).click();await page.getByRole('button',{name:'Editar produto e anotações',exact:true}).click();await input.waitFor();assert.equal(await input.inputValue(),'75,00');await page.getByRole('button',{name:'Mais detalhes e categorias',exact:true}).click();assert.match(await page.getByRole('textbox',{name:'Anotações pessoais',exact:true}).inputValue(),/Preço anterior/);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',checks:['Wish casing','scroll works with hidden indicator','original strikethrough','ordinary/PIX separated','public coupon not auto-applied','explicit PIX choice','manual coupon price editable','SQLite price/context preserved'],pageErrors:errors}));
}finally{await browser.close()}
