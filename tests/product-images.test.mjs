import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProduct } from '../src/services/product-import.ts';
import { fitProductImage } from '../src/domain/image-layout.ts';
const source='https://www.youcom.com.br/camiseta-fixture';
const cdn='https://img.youcom.com.br/';
const product=image=>`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Camiseta',image})}</script>`;
const selected=html=>extractProduct(html,source).product.image_url;
test('Youcom: declared main image wins over first thumbnail and medium OG; no URL is invented',()=>{
 const urls=['t','s','m','l','z'].map(size=>cdn+`same-product_${size}2_stamp.webp`);
 const wrapper='/_next/image?url='+encodeURIComponent(urls[4])+'&amp;w=1920&amp;q=100';
 const html=product(urls)+`<meta property="og:image" content="${urls[3]}"><meta property="og:image:width" content="482"><meta property="og:image:height" content="660"><img alt="camiseta" fetchPriority="high" width="590" height="786" src="${wrapper}">`;
 assert.equal(selected(html),urls[4]);
 assert.equal(selected(product(urls)),urls[0]); // Unknown dimensions/order are not guessed from filename letters.
});
test('ImageObject dimensions/contentUrl and repeated OG groups choose the largest declared resolution',()=>{
 assert.equal(selected(product([{url:cdn+'small.jpg',width:77,height:105},{'@type':'ImageObject',contentUrl:cdn+'large.jpg',width:{value:1022},height:1400}])),cdn+'large.jpg');
 assert.equal(selected(product(cdn+'tiny.jpg')+`<meta property="og:image" content="${cdn}medium.jpg"><meta property="og:image:width" content="482"><meta property="og:image:height" content="660"><meta property="og:image" content="${cdn}big.jpg"><meta property="og:image:width" content="1022"><meta property="og:image:height" content="1400">`),cdn+'big.jpg');
});
test('anchored product srcset uses only published authorized URLs and preserves query parameters',()=>{
 const small=cdn+'small.jpg?width=77&token=keep';const large=cdn+'large.jpg?width=1200&token=keep';
 const html=product(small)+`<img itemprop="image" src="${small.replaceAll('&','&amp;')}" srcset="${small.replaceAll('&','&amp;')} 77w, ${large.replaceAll('&','&amp;')} 1200w, https://m.media-amazon.com/other.jpg 5000w">`;
 assert.equal(selected(html),large);
});
test('unsafe, other-store, fake scripts and unknown optimizer URLs cannot replace the product image',()=>{
 const safe=cdn+'safe.jpg';
 assert.equal(selected(product([{url:'http://img.youcom.com.br/bad.jpg',width:9000},{url:'https://img.youcom.com.br.evil.test/bad',width:9000},{url:'https://m.media-amazon.com/other.jpg',width:9000},safe])),safe);
 assert.equal(selected(product(safe)+`<img alt="Camiseta" fetchpriority="high" src="/_next/image?url=${encodeURIComponent(cdn+'not-declared.jpg')}"><script>const banner='<img itemprop="image" src="${safe}" srcset="${cdn}fake.jpg 9000w">'</script>`),safe);
 assert.equal(selected(product(safe)+`<img alt="Outro produto" fetchpriority="high" src="${safe}" srcset="${cdn}related.jpg 3000w">`),safe);
 assert.equal(selected(product(['javascript:alert(1)','https://127.0.0.1/image'])), '');
});
test('Twitter fallback, missing resolution and single low-quality image retain a manual replacement path',()=>{
 assert.equal(selected(product(null)+`<meta name="twitter:image" content="${cdn}twitter.jpg"><meta name="twitter:image:width" content="800">`),cdn+'twitter.jpg');
 assert.equal(selected(product(cdn+'only-thumbnail.jpg')),cdn+'only-thumbnail.jpg');
});
test('small and large images fit without distortion or stretching beyond physical source pixels',()=>{
 const small=fitProductImage(77,105,360,260,3);assert.ok(Math.abs(small.width-77/3)<1e-10);assert.equal(small.height,35);assert.ok(Math.abs(small.width/small.height-77/105)<1e-10);
 const large=fitProductImage(1022,1400,360,260,3);assert.equal(large.height,260);assert.ok(Math.abs(large.width/large.height-1022/1400)<1e-10);
 assert.equal(fitProductImage(10,10,100,100,1).width,10);
 assert.equal(fitProductImage(0,100,360,260,3),null);assert.equal(fitProductImage(77,105,360,260,0),null);
});
