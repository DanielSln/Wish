import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, Text, View } from 'react-native';
import { useProducts } from '@/data/use-products';
import { type Product, isHttpUrl, money, priorityLabels } from '@/domain/product';
import { Button, useUI } from '@/components/ui';
import { ExpandableText } from '@/components/expandable-text';
import { PersonalNotes } from '@/components/personal-notes';
import { ProductImage } from '@/components/product-image';
export default function ProductDetails() {
  const { colors, styles } = useUI();
  const { id } = useLocalSearchParams<{ id: string }>(); const repo = useProducts();
  const [product, setProduct] = useState<Product | null>(null); const [loading, setLoading] = useState(true);
  const [editingNotes,setEditingNotes]=useState(false);
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
  const rows = [['Categoria',product.category_name],['Prioridade',priorityLabels[product.priority]],['Status',product.status === 'purchased' ? 'Comprado' : 'Pendente'],['Preço conhecido',money(product.price_cents)],['Preço desejado',money(product.desired_price_cents)],['Loja',product.store],['Descrição',product.description]];
  return <ScrollView showsVerticalScrollIndicator={false} style={styles.page} contentContainerStyle={styles.content}><ProductImage uri={product.image_url} large /><Text style={styles.title}>{product.name}</Text>{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Button title={product.status === 'pending' ? 'Marcar como comprado' : 'Reverter para pendente'} disabled={busy||editingNotes} onPress={toggleStatus} />
    <Button title="Editar produto" disabled={busy||editingNotes} onPress={() => router.push({ pathname: '/products/edit', params: { id: product.id } })} />
    {!!product.original_url && <Button title="Ver na loja" variant="secondary" disabled={busy||editingNotes} onPress={openStore} />}
    {rows.map(([label,value]) => <View key={label} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={styles.label}>{label}</Text>{label === 'Descrição' && value ? <ExpandableText text={value} /> : <Text selectable style={styles.body}>{value || 'Não informado'}</Text>}</View>)}
    {!!product.offer_details&&<View style={{gap:8}}><Text style={styles.heading}>Ofertas e condições</Text><ExpandableText text={product.offer_details} label="ofertas e condições"/></View>}
    <PersonalNotes onEditingChange={setEditingNotes} key={product.id} value={product.personal_notes} legacy={product.notes} onSave={async text=>{await repo.savePersonalNotes(product.id,text);setProduct(await repo.get(product.id));}}/>
    <Button title="Excluir produto" disabled={busy||editingNotes} onPress={() => setConfirm(true)} variant="danger" /><Button title="Voltar à lista" disabled={editingNotes} onPress={() => router.replace('/')} />
    <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirm(false); }}><View style={{ flex: 1, backgroundColor: '#000B', justifyContent: 'center', padding: 28 }}><View style={styles.card}><Text style={styles.heading}>Excluir este desejo?</Text><Text style={styles.body}>O produto será removido da sua lista. Essa ação não pode ser desfeita pelo aplicativo.</Text><Button title="Cancelar" disabled={busy||editingNotes} onPress={() => setConfirm(false)} /><Button title={busy ? 'Excluindo…' : 'Confirmar exclusão'} disabled={busy||editingNotes} onPress={remove} variant="danger" /></View></View></Modal>
  </ScrollView>;
}
