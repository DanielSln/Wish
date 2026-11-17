import type { Category } from './product.ts';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const groups = [
  { names:['tecnologia','eletronicos','informatica','perifericos'], words:['headset','fone','monitor','notebook','computador','teclado','mouse','smartphone','celular','tablet','televisao','tv','console'] },
  { names:['casa','moveis','decoracao'], words:['sofa','mesa','cadeira','cama','colchao','armario','tapete','geladeira','fogao','panela'] },
  { names:['roupas','vestuario','moda','calcados'], words:['camiseta','camisa','calca','tenis','vestido','bermuda','sapato','blusa','jaqueta'] },
];
function tokens(s: string) { return normalize(s).split(' ').filter(Boolean); }
export function suggestCategory(name: string, categories: Category[], hint='', description=''): string | null {
  for (const source of [name,hint,description]) {
    const words=tokens(source);if(!words.length)continue;
    const specific=categories.filter(c=>{const t=tokens(c.name);return t.length>0&&t.every(w=>words.includes(w)||words.includes(w.replace(/s$/,'')))});
    if(specific.length===1)return specific[0].id;
    if(specific.length>1)return null;
    const matches=groups.filter(g=>g.words.some(w=>words.includes(w))||g.names.some(w=>words.includes(w)));
    if(matches.length!==1){if(matches.length>1)return null;continue;}
    const custom=categories.filter(c=>matches[0].names.includes(normalize(c.name))&&!['tecnologia','casa','roupas'].includes(normalize(c.name)));
    if(custom.length===1)return custom[0].id;
    for(const alias of matches[0].names){const found=categories.filter(c=>normalize(c.name)===alias);if(found.length===1)return found[0].id;}
  }
  return null;
}
