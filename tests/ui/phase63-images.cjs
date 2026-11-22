// Synthetic images in isolated web SQLite; no live merchant or native gallery access.
const {chromium}=require(process.env.WISH_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.WISH_CHROMIUM_PATH});
 try{
  const context=await browser.newContext({viewport:{width:320,height:740}});const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.WISH_TEST_URL||'http://localhost:8097';await page.goto(base);
  for(const [label,width,height] of [['small',1,1],['large',1600,1200]]){
   const data=await page.evaluate(({width,height})=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const draw=canvas.getContext('2d');draw.fillStyle='#89c5e8';draw.fillRect(0,0,width,height);return canvas.toDataURL('image/png').split(',')[1]},{width,height});
   const image='https://m.media-amazon.com/phase63-'+label+'.png';const url='https://www.amazon.com.br/phase63-image-'+label;const name='Headset imagem '+label+' fixture';
   await context.route(image,r=>r.fulfill({status:200,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'},body:Buffer.from(data,'base64')}));
   await context.route(url,r=>r.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name,image,offers:{price:70,priceCurrency:'BRL'}})+'</script>'}));
   await page.goto(base+'/products/import?url='+encodeURIComponent(url));await page.getByRole('button',{name:'Desejar',exact:true}).waitFor();
   const photo=page.getByRole('img',{name:'Imagem do produto',exact:true});await photo.waitFor();await page.waitForFunction(()=>[...document.images].some(img=>img.src.startsWith('blob:')&&img.complete&&img.naturalWidth>0));
   if(label==='small')await page.getByText('Imagem pequena; preservamos sua proporção sem ampliar demais.',{exact:true}).waitFor();
   const rect=await photo.boundingBox();assert.ok(rect.width>0&&rect.height>0);assert.ok(Math.abs(rect.width/rect.height-width/height)<0.03);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'.expo/phase63-image-'+label+'.png'});
   await page.getByRole('button',{name:'Desejar',exact:true}).click();await page.getByRole('button',{name:'Ver '+name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();await photo.waitFor();const detailsUrl=page.url();await page.waitForTimeout(3800);assert.equal(page.url(),detailsUrl);
   await page.reload();await photo.waitFor();await page.getByRole('button',{name:'Editar produto',exact:true}).click();await page.getByRole('button',{name:'Mais detalhes e categorias',exact:true}).click();
   await page.getByRole('button',{name:'Menos detalhes',exact:true}).waitFor();
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',checks:['small/large imported image loads','aspect ratio preserved without excessive enlargement','image persists after save/reload','320px no overflow','no page errors'],pageErrors:errors}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
