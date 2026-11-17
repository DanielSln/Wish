// Synthetic prices/product; field names mirror the public HTML inspected on 15 Nov 2026.
export const kabumSource='https://www.kabum.com.br/produto/12345/fixture';
export const pricingTime=Date.parse('2026-11-15T12:00:00Z');
export function kabumPage({product={},offer={},banner='Use o cupom TESTE15 e ganhe 15% OFF neste item, cupons limitados. Consulte condições completas.'}={}){
 const data={id:12345,price:100,prices:{oldPrice:150,price:100,priceWithDiscount:80,discountPercentage:20},sellerId:0,sellerName:'KaBuM!',marketplace:{sellerName:'KaBuM!',linkSellerPage:''},available:true,prime:{isLoggedUserExclusive:false},offer:{startDate:pricingTime/1000-3600,endDate:pricingTime/1000+3600,login:false},...product};
 return '<script type="application/ld+json">'+JSON.stringify({'@type':'Product',sku:'12345',name:'Produto de teste',offers:{'@type':'Offer',price:80,priceCurrency:'BRL',...offer}})+'</script><script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{product:data}}})+'</script><p>à vista no PIX</p><p>'+banner+'</p>';
}
