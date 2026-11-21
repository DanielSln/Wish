// UI-only review fixtures in a fresh browser context; never uses the owner's catalogue.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.WISH_PLAYWRIGHT_MODULE||'playwright');
const phase=process.argv[2]||'before',out=path.resolve(process.env.WISH_REVIEW_OUTPUT||'.expo/phase65-review',phase==='settings'?'after':phase);fs.mkdirSync(out,{recursive:true});
const base=process.env.WISH_TEST_URL||'http://localhost:8097';
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.WISH_CHROMIUM_PATH?{executablePath:process.env.WISH_CHROMIUM_PATH}:{})});try{
 const context=await browser.newContext({viewport:{width:412,height:915},colorScheme:'light'});const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const button=name=>page.getByRole('button',{name,exact:true});const box=name=>page.getByRole('textbox',{name,exact:true});
 await page.goto(base,{timeout:120000});await page.getByRole('tab',{name:/Adicionar/}).waitFor({timeout:120000});
 if(phase==='settings'){
  for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme});await page.goto(base+'/settings');await button('Claro').waitFor();await snap(theme+'-settings');}
  await page.setViewportSize({width:320,height:740});await page.addStyleTag({content:'[dir="auto"]{font-size:26px!important;line-height:1.3!important}'});await snap('narrow-scaled-settings');
  if(errors.length)throw Error(JSON.stringify(errors));fs.writeFileSync(path.join(out,'settings-results.json'),JSON.stringify({result:'passed',source:'final responsive theme control',pageErrors:errors},null,2));console.log('Final theme captures passed');return;
 }
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=750;const x=c.getContext('2d');x.fillStyle='#e5f1f8';x.fillRect(0,0,1000,750);x.strokeStyle='#284b63';x.lineWidth=34;x.lineCap='round';x.beginPath();x.arc(500,355,175,Math.PI,0);x.stroke();x.fillStyle='#284b63';x.fillRect(295,345,70,175);x.fillRect(635,345,70,175);x.font='24px sans-serif';x.textAlign='center';x.fillText('IMAGEM CONTROLADA DE TESTE',500,655);return c.toDataURL('image/png').split(',')[1]});
 await context.route('https://m.media-amazon.com/phase65-fixture.png',r=>r.fulfill({status:200,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'},body:Buffer.from(image,'base64')}));
 const longName='Monitor profissional para criação e edição com suporte articulado, conexão USB-C e painel de alta resolução — nome longo para revisão de acessibilidade';
 const fixtures=[{name:'Headset HyperX Cloud III — teste visual',price:499.99,image:true,description:'Produto de teste para conferir hierarquia, condição PIX e ofertas manuais.',specs:[{'@type':'UnitPriceSpecification',priceType:'SalePrice',priceCurrency:'BRL',name:'À vista no PIX',price:399.99}]},{name:longName,price:987654321.99,image:true,description:Array.from({length:12},(_,i)=>`Parágrafo ${i+1}: descrição integral de teste, com especificações e informações do produto. Este conteúdo não deve ser resumido nem alterado no armazenamento.\n`).join('\n')},{name:'Poltrona para leitura — teste sem preço',description:''},{name:'Câmera instantânea — teste comprado',price:599.9,description:'Registro controlado para revisar a aba Comprados.'}];
 for(let i=0;i<fixtures.length;i++){
  const f=fixtures[i],source='https://www.amazon.com.br/phase65-fixture-'+i;await context.route(source,r=>r.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:'<meta property="og:site_name" content="Loja de teste"><script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:f.name,description:f.description,category:i===2?'Casa':'Tecnologia',...(f.image?{image:'https://m.media-amazon.com/phase65-fixture.png'}:{}),...(f.price?{offers:{'@type':'Offer',price:f.price,priceCurrency:'BRL',priceSpecification:f.specs}}:{})})+'</script>'}));
  await page.goto(base+'/products/import?url='+encodeURIComponent(source));await button('Desejar').waitFor();await button(i===2?'Casa':'Tecnologia').click();await button('Desejar').click();await button('Ver '+f.name).waitFor();
 }
 async function details(i){await page.goto(base);await button('Ver '+fixtures[i].name).click();await button('Editar produto').waitFor();}
 async function snap(name){await page.waitForTimeout(250);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
 async function offersOpen(){const disclosure=page.getByRole('button',{name:/^Ofertas por loja/});if(await disclosure.count()&&await disclosure.getAttribute('aria-expanded')!=='true')await disclosure.click();}
 let registeredOffers=0;
 async function addOffer(store,price,conditional){await button('Registrar oferta de uma loja').click();await box('Loja da oferta').fill(store);await box('Preço registrado em reais').fill(price);await box('Link HTTPS da oferta').fill('https://example.com/product?variant=fixture');if(conditional)await page.getByLabel('Preço depende de PIX, cupom ou condição',{exact:true}).click();await box('Variante e condições da oferta').fill(conditional?'PIX com cupom TESTE. Mesmo modelo e variante.':'Mesmo modelo e variante; registro manual não verificado.');await page.getByLabel('Confirmo o mesmo produto e variante',{exact:true}).click();await button('Salvar registro').click();await button('Salvar registro').waitFor({state:'hidden'});await button('Ofertas por loja ('+(++registeredOffers)+')').waitFor();}
 if(phase==='after'){
  for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme});await details(0);await snap(theme+'-comparison-details-pix');}
  await details(0);await addOffer('Loja A de teste','429,90',false);await addOffer('Loja B de teste','389,90',false);await addOffer('Loja C de teste','349,90',true);
 }
 for(const theme of ['light','dark']){
  await page.emulateMedia({colorScheme:theme});await page.goto(base);await button('Ver '+fixtures[0].name).waitFor();await snap(theme+'-home');await details(0);await snap(theme+'-details-pix');
  if(phase==='before')continue;
  await offersOpen();await page.getByText(/389,90 · Loja B de teste/).scrollIntoViewIfNeeded();await snap(theme+'-details-offers');
  await details(1);await snap(theme+'-details-long');const more=button('Ver mais: descrição');await more.scrollIntoViewIfNeeded();await more.click();await snap(theme+'-description-expanded');await button('Ver menos: descrição').click();
  await details(2);await snap(theme+'-details-missing');
  await page.goto(base+'/categories');await button('Criar categoria').waitFor();await snap(theme+'-categories');await page.goto(base+'/add');await box('Nome para começar').waitFor();await snap(theme+'-add');
  await page.goto(base+'/products/import?url='+encodeURIComponent('https://www.amazon.com.br/phase65-fixture-0'));await button('Desejar').waitFor();await snap(theme+'-import');
  await page.goto(base+'/purchased');await page.getByText(/Quando você marcar um desejo como comprado/).waitFor();await snap(theme+'-purchased-empty');
  await details(3);await button('Marcar como comprado').click();await button('Reverter para pendente').waitFor();await page.goto(base+'/purchased');await button('Ver '+fixtures[3].name).waitFor();await snap(theme+'-purchased');await button('Ver '+fixtures[3].name).click();await button('Reverter para pendente').click();await button('Marcar como comprado').waitFor();
  await page.goto(base+'/settings');await button('Claro').waitFor();await snap(theme+'-settings');await details(0);await button('Mais ações do desejo').click();await button('Excluir produto').waitFor();await snap(theme+'-actions');await button('Cancelar').click();
  await button('Registrar oferta de uma loja').click();await box('Loja da oferta').fill('Registro em edição — teste');await snap(theme+'-offer-editor');await button('Cancelar').click();
  await button('Editar anotações pessoais').click();await box('Anotação pessoal').fill('Anotação de teste; nenhuma informação pessoal real.');await snap(theme+'-notes-editor');await button('Cancelar anotação').click();
  await button('Editar produto').click();await box('Nome do produto *').waitFor();await snap(theme+'-edit');
 }
 if(phase==='after'){
  await page.setViewportSize({width:320,height:740});await page.emulateMedia({colorScheme:'dark'});await page.goto(base);await button('Ver '+fixtures[0].name).waitFor();await page.addStyleTag({content:'[dir="auto"]{font-size:26px!important;line-height:1.3!important}'});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Home horizontal overflow');await snap('narrow-scaled-home');await button('Ver '+fixtures[1].name).click();await button('Editar produto').waitFor();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Details horizontal overflow');await snap('narrow-scaled-details');
  await page.goto(base+'/settings');await button('Escuro').waitFor();await page.addStyleTag({content:'[dir="auto"]{font-size:26px!important;line-height:1.3!important}'});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Settings horizontal overflow');await snap('narrow-scaled-settings');
  await page.setViewportSize({width:1024,height:1000});await page.goto(base);await button('Ver '+fixtures[0].name).waitFor();await snap('wide-home');
 }
 if(errors.length)throw Error(JSON.stringify(errors));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({phase,result:'passed',pageErrors:errors,source:'controlled synthetic catalogue; isolated browser context',screenshots:fs.readdirSync(out).filter(n=>n.endsWith('.png'))},null,2));console.log(JSON.stringify({phase,result:'passed',screenshots:fs.readdirSync(out).filter(n=>n.endsWith('.png')).length}));
 }catch(e){console.error(e);for(const c of browser.contexts())for(const p of c.pages()){console.error((await p.locator('body').innerText()).slice(-5000));await p.screenshot({path:path.join(out,'failure.png'),fullPage:true});}throw e}finally{await browser.close()}})().catch(()=>{process.exitCode=1});
