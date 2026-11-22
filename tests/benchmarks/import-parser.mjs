import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {extractProduct} from '../../src/services/product-import.ts';
const source='https://www.amazon.com.br/fixture-benchmark';
const cases={small:'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Headset fixture',offers:{price:100,priceCurrency:'BRL'}})+'</script>',fallback:'<meta property="og:title" content="Produto fixture">'+'<p>Texto público sem preço nem identificador.</p>'.repeat(24000)};
const rows=[];for(const [name,html]of Object.entries(cases)){for(let i=0;i<3;i++)extractProduct(html,source);const times=[];for(let i=0;i<15;i++){const start=performance.now();extractProduct(html,source);times.push(performance.now()-start);}times.sort((a,b)=>a-b);rows.push({name,bytes:Buffer.byteLength(html),medianMs:times[7],maxMs:times.at(-1)});}
mkdirSync('.expo/phase80',{recursive:true});
const output={runtime:process.version,mode:'Node synthetic parser benchmark; not Android/store latency',rows};writeFileSync('.expo/phase80/parser-'+(process.argv[2]??'before')+'.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output));
