// Real browser geometry and routes; CSS text-only scaling is not native Android fontScale.
const assert=require('node:assert/strict'),fs=require('node:fs');const {chromium}=require(process.env.WISH_PLAYWRIGHT_MODULE||'playwright');
const names=['Início','Categorias','Adicionar','Comprados','Configurações'];const routes=['/','/categories','/add','/purchased','/settings'];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.WISH_CHROMIUM_PATH});const results=[];try{
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:320,height:740},colorScheme:theme});const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.WISH_TEST_URL||'http://localhost:8097')+'/settings',{timeout:120000});await page.getByRole('tab',{name:'Configurações',exact:true}).waitFor({timeout:120000});
  const style=await page.addStyleTag({content:'/* normal scale */'});
  for(const [width,height] of [[320,740],[360,800],[412,915],[640,360],[768,1000],[1024,1000]]){
   await page.setViewportSize({width,height});
   for(const scale of [1,1.3,1.6,2,2.6,3.2]){
    await style.evaluate((e,size)=>{e.textContent=size===10?'':'[data-testid^="tab-label-"],[data-testid="tab-font-probe"]{font-size:'+size+'px!important;line-height:1.4!important}'},10*scale);
    await page.waitForTimeout(120);
    assert.equal(await page.getByRole('tab').count(),5);
    const geometry=await page.getByRole('tab').evaluateAll((tabs,names)=>tabs.map((tab,index)=>{
     const text=tab.querySelector('[data-testid="tab-label-'+names[index]+'"]');const r=tab.getBoundingClientRect(),t=text.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(text);const glyph=range.getBoundingClientRect();const s=getComputedStyle(text);return {name:tab.getAttribute('aria-label'),text:text.textContent,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height,textY:t.y,textBottom:t.bottom,textHeight:t.height,scrollHeight:text.scrollHeight,clientHeight:text.clientHeight,glyphLeft:glyph.left,glyphRight:glyph.right,overflow:s.textOverflow,lineClamp:s.webkitLineClamp};
    }),names);
    for(let i=0;i<geometry.length;i++){
     const g=geometry[i];assert.equal(g.name,names[i]);assert.equal(g.text,names[i]);assert.ok(g.width>=44&&g.height>=44);assert.ok(g.textY>=g.y-1&&g.textBottom<=g.bottom+1,'label vertically inside touch area '+JSON.stringify(g));
     if(scale>1){assert.ok(g.scrollHeight<=g.clientHeight+1,'label content clipped');assert.ok(g.glyphLeft>=g.x-1&&g.glyphRight<=g.right+1,'label crosses adjacent tab '+JSON.stringify({theme,width,scale,g}));assert.notEqual(g.lineClamp,'1');}
     if(i)assert.ok(g.x>=geometry[i-1].right-1,'touch areas overlap');assert.ok(g.bottom<=height+1);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page horizontal overflow');
    if((width===320&&scale===1.6)||(width===412&&scale===2.6)||(width===640&&scale===3.2))await page.screenshot({path:'.expo/tab-label-'+theme+'-'+width+'-scale'+scale+'.png',fullPage:true});
    const bar=await page.getByRole('tablist').locator('..').boundingBox();if(scale===1)assert.equal(bar.height,72);assert.ok(height-bar.height>=height*0.4,'navigation consumes excessive viewport');results.push({theme,width,height,scale,barHeight:bar.height});
   }
  }
  // Reproduce the original global CSS26 case, including the icon text, then press
  // every original destination and verify route/selection rather than just labels.
  await style.evaluate(e=>{e.textContent='[dir="auto"]{font-size:26px!important;line-height:1.3!important}'});await page.setViewportSize({width:320,height:740});await page.waitForTimeout(150);
  for(let i=0;i<names.length;i++){await page.getByRole('tab',{name:names[i],exact:true}).click();await page.waitForFunction(name=>document.querySelector('[role="tab"][aria-label="'+name+'"]')?.getAttribute('aria-selected')==='true',names[i]);assert.equal(new URL(page.url()).pathname,routes[i]);}
  const enlarged=await page.getByRole('tablist').locator('..').boundingBox();assert.ok(enlarged.height>72);
  await style.evaluate(e=>{e.textContent=''});await page.waitForFunction(()=>Math.abs(document.querySelector('[role="tablist"]').parentElement.getBoundingClientRect().height-72)<0.1);assert.deepEqual(errors,[]);await context.close();
 }
 fs.writeFileSync('.expo/tab-label-matrix.json',JSON.stringify(results,null,2));console.log(JSON.stringify({result:'passed',scenarios:results.length,checks:['five routes and full accessible labels','normal 72px restored','44px touch targets without overlap','unclipped multi-line text','scaled labels do not cross other tabs','320/360/412/640 landscape/768/1024','1/1.3/1.6/2/2.6/3.2 text scales','light/dark','global CSS26 reproduction','all destinations still selectable','remaining content viewport'],pageErrors:[]}));
 }catch(error){console.error(error);for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:'.expo/tab-label-failure.png',fullPage:true})}throw error}finally{await browser.close()}})().catch(()=>{process.exitCode=1});
