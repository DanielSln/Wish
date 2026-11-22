import { remoteImageUrl } from './image-management.ts';
export type Offer = { id:string; product_id:string; store:string; price_cents:number; url:string; condition:string; conditional:number; recorded_at:string; created_at:string; updated_at:string; deleted_at:string|null };
export type OfferInput = Pick<Offer,'store'|'price_cents'|'url'|'condition'|'conditional'>;
export function validateOffer(input: OfferInput) {
  if (!input.store.trim() || input.store.trim().length > 160) throw new Error('Informe uma loja com até 160 caracteres.');
  if (!Number.isSafeInteger(input.price_cents) || input.price_cents <= 0 || input.price_cents > 99999999999) throw new Error('Informe um preço maior que zero.');
  remoteImageUrl(input.url);
  if (input.condition.length > 1000) throw new Error('Use até 1.000 caracteres nas condições.');
  if (![0,1].includes(input.conditional)) throw new Error('Informe se o preço depende de condições.');
  if (input.conditional && !input.condition.trim()) throw new Error('Descreva a condição do preço (PIX, cupom ou outra).');
}
export function orderedOffers(offers: Offer[]) {
  return offers.filter(offer=>!offer.deleted_at && Number.isSafeInteger(offer.price_cents) && offer.price_cents>0 && offer.price_cents<=99999999999).sort((a,b)=>a.price_cents-b.price_cents || b.recorded_at.localeCompare(a.recorded_at) || a.id.localeCompare(b.id));
}
