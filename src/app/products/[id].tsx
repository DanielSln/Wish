import { useCallback, useState } from 'react';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useProducts } from '@/data/use-products';
import { type Product, isHttpUrl, money } from '@/domain/product';
import { Button, TextButton, IconButton, useUI } from '@/components/ui';
import { ExpandableText } from '@/components/expandable-text';
import { Disclosure } from '@/components/disclosure';
import { ProductOffers } from '@/components/product-offers';
import { PricePriority } from '@/components/price-priority';
import { Icon } from '@/components/brand';
import { KeyboardDialog } from '@/components/keyboard-dialog';
import { commercialDisplay } from '@/domain/commercial-display';
import { PersonalNotes } from '@/components/personal-notes';
import { ProductImage } from '@/components/product-image';
export default function ProductDetails() {
  const { colors, styles } = useUI();
  const { id } = useLocalSearchParams<{ id: string }>(); const repo = useProducts();
  const [product, setProduct] = useState<Product | null>(null); const [loading, setLoading] = useState(true);
  const [editingNotes,setEditingNotes]=useState(false);
  const [menu,setMenu]=useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false); const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    void retry; let alive = true; setLoading(true); setError('');
    if (typeof id !== 'string') { setLoading(false); setProduct(null); return; }
    repo.get(id).then(p => { if (alive) setProduct(p); }).catch(() => { if (alive) setError('Não foi possível carregar o produto.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [repo, id, retry]));
  async function toggleStatus() {
    if (!product || busy) return;
    setBusy(true); setError('');
    try { await repo.setStatus(product.id, product.status === 'pending' ? 'purchased' : 'pending'); setProduct(await repo.get(product.id)); }
    catch { setError('Não foi possível atualizar o status. Tente novamente.'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!product || busy) return;
    setBusy(true); setError('');
    try { await repo.remove(product.id); setConfirm(false); router.replace('/'); } catch { setConfirm(false); setError('Não foi possível excluir o produto.'); } finally { setBusy(false); }
  }
  async function openStore() {
    if (!product || !isHttpUrl(product.original_url)) return;
    try { await Linking.openURL(product.original_url); } catch { Alert.alert('Não foi possível abrir o link', 'Confira o endereço cadastrado e tente novamente.'); setError('Não foi possível abrir o link da loja.'); }
  }
  if (loading) return <View style={styles.page}><ActivityIndicator color={colors.accent} /></View>;
  if (!product) return <View style={styles.page}><Text style={styles.error}>{error || 'Este produto não está disponível.'}</Text><Button title="Tentar novamente" onPress={() => setRetry(r => r + 1)} /><Button title="Voltar à lista" disabled={editingNotes} onPress={() => router.replace('/')} /></View>;
  const commercial=commercialDisplay(product.offer_details,product.price_cents);
  const locked=busy||editingNotes;
  return <>
    <Stack.Screen options={{title:'',headerBackVisible:false,headerLeft:()=> <IconButton label="Voltar à lista" disabled={editingNotes} onPress={()=>router.replace('/')}><Icon name="back" size={23}/></IconButton>,headerRight:()=> <View style={{flexDirection:'row',gap:4}}><IconButton label="Editar produto" disabled={locked} onPress={()=>router.push({pathname:'/products/edit',params:{id:product.id}})}><Icon name="edit" size={22}/></IconButton><IconButton label="Mais ações do desejo" disabled={locked} expanded={menu} onPress={()=>setMenu(true)}><Icon name="more" size={23}/></IconButton></View>}}/>
    <ScrollView showsVerticalScrollIndicator={false} style={styles.page} contentContainerStyle={[styles.content,{gap:16,paddingTop:4}]}>
      <View style={{gap:10}}><ProductImage uri={product.image_url} large compact/>
        {!!product.category_name&&<Text style={[styles.body,{fontSize:13,fontWeight:'600'}]}>{product.category_name}</Text>}
        <ExpandableText key={'name:'+product.id} text={product.name} label="nome do desejo" variant="title"/>
        <PricePriority price={product.price_cents} priority={product.priority} detail/>
        {!!(product.store||commercial.condition)&&<Text style={styles.body}>{[commercial.condition,product.store].filter(Boolean).join(' · ')}</Text>}
      </View>
      {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={{gap:4}}>{isHttpUrl(product.original_url)&&<Button title="Ver na loja" disabled={locked} onPress={openStore}/>}<Button title={product.status==='pending'?'Marcar como comprado':'Reverter para pendente'} variant="secondary" disabled={locked} onPress={toggleStatus} style={{paddingVertical:12}}/></View>
      <View style={styles.divider}/><ProductOffers key={'offers:'+product.id} product={product} disabled={locked}/>
      {!!product.description&&<><View style={styles.divider}/><View style={{gap:6}}><Text accessibilityRole="header" style={[styles.heading,{fontSize:17}]}>Descrição</Text><ExpandableText text={product.description}/></View></>}
      {!!commercial.text&&<><View style={styles.divider}/><Disclosure title="Condições da oferta"><ExpandableText text={commercial.text} label="ofertas e condições"/></Disclosure></>}
      {product.desired_price_cents!==null&&<><View style={styles.divider}/><Disclosure title="Informações adicionais"><Text style={styles.label}>Preço desejado</Text><Text style={styles.body}>{money(product.desired_price_cents)}</Text></Disclosure></>}
      <View style={styles.divider}/><PersonalNotes onEditingChange={setEditingNotes} key={'notes:'+product.id} value={product.personal_notes} legacy={product.notes} onSave={async text=>{await repo.savePersonalNotes(product.id,text);setProduct(await repo.get(product.id));}}/>
    </ScrollView>
    <KeyboardDialog visible={menu} onClose={()=>setMenu(false)}><View style={styles.card}><Text style={styles.heading}>Ações do desejo</Text><TextButton title="Excluir produto" danger disabled={locked} onPress={()=>{setMenu(false);setConfirm(true)}}/><TextButton title="Cancelar" onPress={()=>setMenu(false)}/></View></KeyboardDialog>
    <KeyboardDialog visible={confirm} onClose={()=>{if(!busy)setConfirm(false)}}><View style={styles.card}><Text style={styles.heading}>Excluir este desejo?</Text><Text style={styles.body}>O produto será removido da sua lista. Essa ação não pode ser desfeita pelo aplicativo.</Text><Button title="Cancelar" variant="secondary" disabled={locked} onPress={()=>setConfirm(false)}/><Button title={busy?'Excluindo…':'Confirmar exclusão'} disabled={locked} onPress={remove} variant="danger"/></View></KeyboardDialog>
  </>;
}
