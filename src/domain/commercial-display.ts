// Display only. Never selects/recalculates a price or writes back to imported evidence.
import { money } from './product.ts';
export function commercialDisplay(details:string, price:number|null) {
  const lines=details.split(/\r?\n/);
  const adjusted=lines.some(line=>line.startsWith('Preço ajustado manualmente no cadastro:'));
  const prefix=price===null?'':('Preço selecionado: '+money(price)+' — ');
  const selected=prefix?lines.find(line=>line.startsWith(prefix)):undefined;
  const label=selected?.slice(prefix.length).replace(/\.$/,'')??'';
  // Only the explicit selected-price marker from the importer may supply a headline
  // condition. Free-form/legacy notes and equal numbers are not interpreted.
  const condition=adjusted?'Preço ajustado manualmente':/PIX|cupom/i.test(label)?label:'';
  const publicLines=lines.filter(line=>!['Preço não confirmado.','Cadastro manual. Preço não confirmado; link original preservado.'].includes(line.trim()) && ! /^(Origem:|Consulta:|Preço selecionado:|Preço ajustado manualmente no cadastro:)/.test(line));
  const text=publicLines.map(line=>line.replace(/https?:\/\/[^\s]+/g,'').trim()).filter(Boolean).join('\n');
  return { condition:condition.replace(/https?:\/\/[^\s]+/g,'').trim(), text };
}
