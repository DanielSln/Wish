import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useProducts } from '@/data/use-products';
import { type Category, type ProductInput, type Priority, parsePrice, priorityLabels, validateProduct } from '@/domain/product';
import { Button, Chip, useUI } from './ui';
import { ProductImage } from './product-image';
const empty: ProductInput = { name: '', description: '', category_id: '', priority: 'medium', image_url: '', price_cents: null, desired_price_cents: null, store: '', original_url: '', notes: '', status: 'pending' };
export function ProductForm({ id, initial, onSaved }: { id?: string; initial?: Partial<ProductInput>; onSaved?: () => void }) {
  const { colors, styles } = useUI();
  const repo = useProducts();
  const [details, setDetails] = useState(false);
  const [input, setInput] = useState<ProductInput>(empty);
  const [price, setPrice] = useState(''); const [desiredPrice, setDesiredPrice] = useState('');
  const [categories, setCategories] = useState<Category[]>([]); const [newCategory, setNewCategory] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({}); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) { setLoading(true); setLoadError(''); } });
    Promise.all([repo.categories(), id ? repo.get(id) : Promise.resolve(null)]).then(([cats, product]) => {
      if (!alive) return;
      if (id && !product) { setLoadError('Produto não encontrado.'); return; }
      setCategories(cats);
      if (product) { setInput(product); setPrice(product.price_cents === null ? '' : (product.price_cents / 100).toFixed(2).replace('.', ',')); setDesiredPrice(product.desired_price_cents === null ? '' : (product.desired_price_cents / 100).toFixed(2).replace('.', ',')); }
      else {
        setInput({ ...empty, ...initial, category_id: cats[0]?.id ?? '' });
        setPrice(initial?.price_cents == null ? '' : (initial.price_cents / 100).toFixed(2).replace('.', ','));
      }
    }).catch(() => { if (alive) setLoadError('Não foi possível carregar o formulário.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [repo, id, retry, initial]);
  async function save() {
    if (busy) return;
    const next = { ...input, name: input.name.trim(), original_url: input.original_url.trim(), image_url: input.image_url.trim() };
    const validation = validateProduct(next);
    try { next.price_cents = parsePrice(price); } catch (e) { validation.price_cents = (e as Error).message; }
    try { next.desired_price_cents = parsePrice(desiredPrice); } catch (e) { validation.desired_price_cents = (e as Error).message; }
    setErrors(validation); setError('');
    if (Object.keys(validation).length) { setDetails(true); setError('Revise os campos destacados abaixo.'); return; }
    setBusy(true);
    try { const savedId = await repo.save(next, id); onSaved?.(); router.replace({ pathname: '/products/[id]', params: { id: savedId } }); }
    catch { setError('Não foi possível salvar o desejo. Seus campos foram preservados; tente novamente.'); }
    finally { setBusy(false); }
  }
  async function addCategory() {
    if (busy) return;
    setBusy(true); setError('');
    try { const categoryId = await repo.addCategory(newCategory); setCategories(await repo.categories()); setInput(v => ({ ...v, category_id: categoryId })); setNewCategory(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar a categoria.'); }
    finally { setBusy(false); }
  }
  function field(key: 'name' | 'original_url' | 'image_url' | 'store' | 'description' | 'notes', label: string, multiline = false) {
    return <View key={key}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} value={input[key]} onChangeText={value => setInput(v => ({ ...v, [key]: value }))} style={[styles.input, multiline && { minHeight: 110, textAlignVertical: 'top' }, !!errors[key] && { borderColor: colors.error }]} multiline={multiline} autoCapitalize={key.includes('url') ? 'none' : 'sentences'} keyboardType={key.includes('url') ? 'url' : 'default'} maxLength={key === 'name' || key === 'store' ? 160 : key.includes('url') ? 2048 : 10000} placeholderTextColor={colors.muted} />{!!errors[key] && <Text style={styles.error}>{errors[key]}</Text>}</View>;
  }
  if (loading) return <View style={styles.page}><ActivityIndicator color={colors.accent} /></View>;
  if (loadError) return <View style={styles.page}><Text style={styles.error}>{loadError}</Text><Button title="Tentar novamente" onPress={() => setRetry(r => r + 1)} /></View>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.heading}>{id ? 'Seu desejo, do seu jeito' : 'O que você quer conquistar?'}</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!input.image_url && <ProductImage uri={input.image_url} large />}
    {field('name', 'Nome do produto *')}
    {!!input.store && <Text style={styles.body}>{input.store}</Text>}
    <View><Text style={styles.label}>Categoria</Text><View style={styles.row}>{categories.map(c => <Chip key={c.id} title={c.name} active={input.category_id === c.id} onPress={() => !busy && setInput(v => ({ ...v, category_id: c.id }))} />)}</View>{!!errors.category_id && <Text style={styles.error}>{errors.category_id}</Text>}</View>
    <View><Text style={styles.label}>Preço conhecido (R$)</Text><TextInput accessibilityLabel="Preço conhecido" editable={!busy} style={styles.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="1299,90" placeholderTextColor={colors.muted} />{!!errors.price_cents && <Text style={styles.error}>{errors.price_cents}</Text>}</View>
    <Button title={details ? 'Menos detalhes' : 'Mais detalhes e categorias'} variant="secondary" onPress={() => setDetails(v => !v)} />
    {details && <View style={{ gap: 22 }}>
    <View><Text style={styles.label}>Nova categoria</Text><TextInput accessibilityLabel="Nome da nova categoria" editable={!busy} style={styles.input} placeholder="Ex.: Livros" placeholderTextColor={colors.muted} value={newCategory} onChangeText={setNewCategory} maxLength={60} /><Button title="Criar categoria" disabled={busy || !newCategory.trim()} onPress={addCategory} style={{ marginTop: 10 }} /></View>
    <View><Text style={styles.label}>Prioridade</Text><View style={styles.row}>{(Object.keys(priorityLabels) as Priority[]).map(p => <Chip key={p} title={priorityLabels[p]} active={input.priority === p} onPress={() => !busy && setInput(v => ({ ...v, priority: p }))} />)}</View></View>
    {field('original_url','Link do produto (opcional)')}{field('image_url','URL da imagem (opcional)')}
    <View><Text style={styles.label}>Preço desejado (R$)</Text><TextInput accessibilityLabel="Preço desejado" editable={!busy} style={styles.input} keyboardType="decimal-pad" value={desiredPrice} onChangeText={setDesiredPrice} placeholder="999,90" placeholderTextColor={colors.muted} />{!!errors.desired_price_cents && <Text style={styles.error}>{errors.desired_price_cents}</Text>}</View>
    {field('store','Loja')}{field('description','Descrição',true)}{field('notes','Anotações pessoais',true)}
    </View>}
    <Button title={busy ? 'Salvando…' : 'Salvar desejo'} disabled={busy} onPress={save} />
  </ScrollView></KeyboardAvoidingView>;
}
