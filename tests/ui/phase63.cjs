// PREPARED, NOT RUN in phase 6.3 implementation. Requires isolated web database.
const {chromium}=require(process.env.WISH_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.WISH_CHROMIUM_PATH?{executablePath:process.env.WISH_CHROMIUM_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:320,height:740},colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.WISH_TEST_URL||'http://localhost:8093';
  const button=name=>page.getByRole('button',{name,exact:true});
  const source='https://www.amazon.com.br/phase63-ui';
  const item={'@type':'Product',name:'Headset phase63 fixture',sku:'TEST-SKU',description:'Descrição completa preservada.',offers:{'@type':'Offer',price:100,priceCurrency:'BRL',priceSpecification:{'@type':'UnitPriceSpecification',priceType:'SalePrice',name:'PIX com cupom TESTE15',price:70,priceCurrency:'BRL'}}};
  await context.route(source,r=>r.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:'<script type="application/ld+json">'+JSON.stringify(item)+'</script>'}));
  async function preview(){await page.goto(base+'/products/import?url='+encodeURIComponent(source));await button('Desejar').waitFor();}
  await preview();assert.equal(await button('Tecnologia').getAttribute('aria-pressed'),'true');assert.equal(await button('Média').getAttribute('aria-pressed'),'true');
  assert.equal(await button('Descrição').getAttribute('aria-expanded'),'false');assert.equal(await button('Condições e origem').getAttribute('aria-expanded'),'false');
  await button('Editar informações').click();const price=page.getByRole('textbox',{name:'Preço conhecido',exact:true});assert.equal(await price.inputValue(),'70,00');await price.fill('60,00');await button('Cancelar edição').click();
  await button('Editar informações').click();assert.equal(await price.inputValue(),'70,00');await button('Cancelar edição').click();
  await page.emulateMedia({colorScheme:'dark'});await page.addStyleTag({content:'[dir="auto"] {font-size:26px!important;line-height:1.3!important;}'});
  await button('Descrição').click();await page.getByText(item.description,{exact:true}).waitFor();await button('Descrição').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // Two actual click events in one task, rather than relying on a delayed second click.
  await button('Desejar').evaluate(element=>{element.click();element.click()});
  await button('Ver Headset phase63 fixture').waitFor();assert.equal(await button('Ver Headset phase63 fixture').count(),1);
  await page.reload();await button('Ver Headset phase63 fixture').click();await button('Editar produto').click();assert.equal(await price.inputValue(),'70,00');
  await page.goto(base+'/products/import?url='+encodeURIComponent(source));await button('Editar informações').click();await price.fill('65,00');await button('Salvar desejo').click();await button('Ver Headset phase63 fixture').first().waitFor();
  const missing='https://www.amazon.com.br/phase63-missing';await context.route(missing,r=>r.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',description:'Sem nome, preço ou imagem.'})+'</script>'}));
  await page.goto(base+'/products/import?url='+encodeURIComponent(missing));await button('Desejar').click();await page.getByRole('textbox',{name:'Nome do produto *',exact:true}).fill('Desejo mínimo fixture');await button('Casa').click();await button('Desejar').click();await button('Ver Desejo mínimo fixture').waitFor();
  assert.deepEqual(errors,[]);console.log('Phase 6.3 browser scenarios completed in this future run. Android validation remains separate.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
