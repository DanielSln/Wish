const fs=require('node:fs'),path=require('node:path');const {chromium}=require(process.env.WISH_PLAYWRIGHT_MODULE||'playwright');
const stage=process.argv[2]||'before',out=path.resolve(process.env.WISH_NAV_OUTPUT||'.expo/nav-label-review',stage);fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.WISH_CHROMIUM_PATH?{executablePath:process.env.WISH_CHROMIUM_PATH}:{})});try{
 const records=[];
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:320,height:740},colorScheme:theme});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.WISH_TEST_URL||'http://localhost:8097')+'/settings',{timeout:120000});await page.getByRole('tab',{name:/Configurações/}).waitFor({timeout:120000});await page.evaluate(()=>document.fonts.ready);
  for(const [width,height] of [[320,740],[360,800],[412,915],[640,360],[768,1000],[1024,1000]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(250);const bar=page.getByRole('tablist').locator('..');
   const labels=await page.getByRole('tab').evaluateAll(tabs=>tabs.map(tab=>{const text=[...tab.querySelectorAll('[dir="auto"]')].find(e=>['Início','Categorias','Adicionar','Comprados','Configurações'].includes(e.textContent));const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};const s=text?getComputedStyle(text):null;return{name:text?.textContent,tab:rect(tab),label:text?rect(text):null,font:s?.fontFamily,size:s?.fontSize,lineHeight:s?.lineHeight,color:s?.color}}));
   await bar.screenshot({path:path.join(out,theme+'-'+width+'-normal-bar.png')});records.push({theme,width,height,scale:'normal',bar:await bar.boundingBox(),labels});
  }
  await page.setViewportSize({width:320,height:740});await page.addStyleTag({content:'[dir="auto"]{font-size:26px!important;line-height:1.3!important}'});await page.waitForTimeout(300);await page.screenshot({path:path.join(out,theme+'-320-global26.png')});await page.getByRole('tablist').locator('..').screenshot({path:path.join(out,theme+'-320-global26-bar.png')});
  if(errors.length)throw Error(JSON.stringify(errors));await context.close();
 }
 fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify(records,null,2));console.log(JSON.stringify({stage,scenarios:records.length,result:'captured'}));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
