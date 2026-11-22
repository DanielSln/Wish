import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Switch, Text, TextInput, View } from 'react-native';
import { useProducts } from '@/data/use-products';
import { orderedOffers, validateOffer, type Offer } from '@/domain/offers';
import { money, parsePrice, type Product } from '@/domain/product';
import { Disclosure } from './disclosure';
import { Button, TextButton, IconButton, SectionHeading, useUI } from './ui';
import { Icon } from './brand';
import { KeyboardDialog } from './keyboard-dialog';
import { ExpandableText } from './expandable-text';
export function ProductOffers({ product, disabled=false }: { product: Product; disabled?: boolean }) {
  const repo=useProducts(); const {styles:s,colors:c}=useUI();
  const [offers,setOffers]=useState<Offer[]>([]); const [reload,setReload]=useState(0);
  const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [editing,setEditing]=useState<Offer|null|undefined>(undefined);const [removing,setRemoving]=useState<Offer|null>(null);
  const [store,setStore]=useState('');const [price,setPrice]=useState('');const [url,setUrl]=useState('');const [condition,setCondition]=useState('');const [conditional,setConditional]=useState(false);const [identity,setIdentity]=useState(false);
  const [busy,setBusy]=useState(false);const [formError,setFormError]=useState('');
  useFocusEffect(useCallback(()=>{
    let active=true;setLoading(true);setError('');void reload;
    repo.offers(product.id).then(items=>{if(active)setOffers(items)}).catch(()=>{if(active)setError('Não foi possível carregar as ofertas. Tente novamente.');}).finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[repo,product.id,reload]));
  function edit(offer:Offer|null) {
    setEditing(offer);setStore(offer?.store??'');setPrice(offer?String(offer.price_cents/100).replace('.',','):'');setUrl(offer?.url??'');setCondition(offer?.condition??'');setConditional(!!offer?.conditional);setIdentity(false);setFormError('');
  }
  async function save() {
    if(busy||disabled)return;setFormError('');
    try {
      if(!identity)throw new Error('Confirme o modelo e a variante antes de registrar a oferta.');
      const input={store,price_cents:parsePrice(price)??0,url:url.trim(),condition,conditional:conditional?1:0};
      validateOffer(input);setBusy(true);
      await repo.saveOffer(product.id,input,editing?.id);setEditing(undefined);setReload(v=>v+1);
    } catch(e) {setFormError(e instanceof Error?e.message:'Não foi possível salvar a oferta.');} finally {setBusy(false)}
  }
  async function remove() {
    if(!removing||busy||disabled)return;setBusy(true);setFormError('');
    try{await repo.removeOffer(product.id,removing.id);setRemoving(null);setReload(v=>v+1)}catch{setFormError('Não foi possível remover a oferta. Tente novamente.')}finally{setBusy(false)}
  }
  async function open(offer:Offer) {
    try{validateOffer(offer);await Linking.openURL(offer.url)}catch{setError('Não foi possível abrir a oferta. Confira o link HTTPS cadastrado.');}
  }
  const valid=orderedOffers(offers);const normal=valid.filter(o=>!o.conditional);const dependent=valid.filter(o=>o.conditional);
  const lowest=normal[0]?.price_cents;
  function row(offer:Offer) {
    return <View key={offer.id} style={{gap:5,paddingVertical:8,borderBottomWidth:1,borderBottomColor:c.border}}>
      <Text style={{color:c.text,fontSize:17,fontWeight:'700'}}>{money(offer.price_cents)} · {offer.store}</Text>
      {!offer.conditional&&offer.price_cents===lowest&&normal.length>1&&<Text style={{color:c.primary,fontSize:12}}>Menor valor registrado sem condição</Text>}
      <Text style={[s.body,{fontSize:12}]}>Registro manual: {new Date(offer.recorded_at).toLocaleString('pt-BR')}. Não verificado na loja.</Text>
      {!!offer.condition&&<ExpandableText text={offer.condition} label="condições da oferta"/>}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><TextButton title="Ver oferta" onPress={()=>open(offer)}/><TextButton title="Editar" disabled={disabled||busy} onPress={()=>edit(offer)}/><TextButton title="Remover" danger disabled={disabled||busy} onPress={()=>{setFormError('');setRemoving(offer)}}/></View>
    </View>;
  }
  return <View style={{gap:8}}>
    <SectionHeading title="Ofertas registradas" action={<IconButton label="Registrar oferta de uma loja" disabled={disabled||busy||loading} onPress={()=>edit(null)}><Icon name="add" color={c.primary} size={22}/></IconButton>}/>
    {loading&&<Text style={s.body}>Carregando ofertas…</Text>}
    {!loading&&!valid.length&&<Text style={s.body}>Nenhuma oferta registrada</Text>}
    {!!valid.length&&<>
      <Text style={[s.body,{fontSize:13}]}>Registros manuais, não cotações em tempo real.</Text>
      <Disclosure title={`Ofertas por loja (${valid.length})`}>
        {!!normal.length&&<><Text style={s.label}>Sem condição</Text><Text style={s.body}>Menor sem condição: {money(normal[0].price_cents)}</Text>{normal.map(row)}</>}
        {!!dependent.length&&<><Text style={s.label}>Preços condicionados — classificação separada</Text><Text style={s.body}>Menor condicionado: {money(dependent[0].price_cents)} — consulte as condições.</Text>{dependent.map(row)}</>}
      </Disclosure>
    </>}
    {!!error&&<><Text accessibilityRole="alert" style={s.error}>{error}</Text><TextButton title="Tentar novamente" onPress={()=>setReload(v=>v+1)}/></>}

    <KeyboardDialog visible={editing!==undefined} onClose={()=>{if(!busy)setEditing(undefined)}}><View style={s.card}>
      <Text style={s.heading}>{editing?'Editar oferta':'Registrar oferta'}</Text><Text style={s.body}>{product.name}</Text>
      <Text style={[s.body,{fontSize:12}]}>Confira o mesmo modelo, capacidade, cor, kit e estado do produto. Não use valores de produtos semelhantes.</Text>
      <TextInput accessibilityLabel="Loja da oferta" placeholder="Loja" placeholderTextColor={c.muted} style={s.input} value={store} onChangeText={setStore} maxLength={160} editable={!busy}/>
      <TextInput accessibilityLabel="Preço registrado em reais" placeholder="Preço em R$" placeholderTextColor={c.muted} keyboardType="decimal-pad" style={s.input} value={price} onChangeText={setPrice} editable={!busy}/>
      <TextInput accessibilityLabel="Link HTTPS da oferta" placeholder="https://loja.com/produto" placeholderTextColor={c.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} value={url} onChangeText={setUrl} maxLength={2048} editable={!busy}/>
      <View style={s.row}><Switch accessibilityLabel="Preço depende de PIX, cupom ou condição" value={conditional} onValueChange={setConditional} disabled={busy}/><Text style={[s.body,{flex:1}]}>Depende de PIX, cupom ou outra condição</Text></View>
      <TextInput accessibilityLabel="Variante e condições da oferta" placeholder="Variante, estado, quantidade e condições" placeholderTextColor={c.muted} style={[s.input,{textAlignVertical:'top'}]} multiline value={condition} onChangeText={setCondition} maxLength={1000} editable={!busy}/>
      <View style={s.row}><Switch accessibilityLabel="Confirmo o mesmo produto e variante" value={identity} onValueChange={setIdentity} disabled={busy}/><Text style={[s.body,{flex:1}]}>Conferi que a oferta corresponde a este produto e variante.</Text></View>
      {!!formError&&<Text accessibilityRole="alert" style={s.error}>{formError}</Text>}
      <Button title={busy?'Salvando…':'Salvar registro'} disabled={busy||disabled} onPress={save}/><Button title="Cancelar" variant="secondary" disabled={busy} onPress={()=>setEditing(undefined)}/>
    </View></KeyboardDialog>
    <KeyboardDialog visible={!!removing} onClose={()=>{if(!busy)setRemoving(null)}}><View style={s.card}><Text style={s.heading}>Remover esta oferta?</Text><Text style={s.body}>{removing?.store} · {removing?money(removing.price_cents):''}</Text>{!!formError&&<Text accessibilityRole="alert" style={s.error}>{formError}</Text>}<Button title="Confirmar remoção" variant="danger" disabled={busy||disabled} onPress={remove}/><Button title="Cancelar" variant="secondary" disabled={busy} onPress={()=>setRemoving(null)}/></View></KeyboardDialog>
  </View>;
}
