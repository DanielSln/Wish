import { KeyboardScrollView } from './keyboard-scroll-view';
import { KeyboardDialog } from './keyboard-dialog';
import { ImageEditor } from './image-editor';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useProducts } from '@/data/use-products';
import { type Category, type ProductInput, type Priority, money, parsePrice, priorityLabels, validateProduct } from '@/domain/product';
import { Button, Chip, useUI } from './ui';
import { suggestCategory } from '@/domain/category-suggestion';
import { ExpandableText } from './expandable-text';
import { DescriptionField } from './description-field';
import { ProductImage } from './product-image';
import { createSaveGate } from '@/domain/import-draft';
const empty: ProductInput = { name: '', description: '', category_id: '', priority: 'medium', image_url: '', price_cents: null, desired_price_cents: null, store: '', original_url: '', notes: '', personal_notes: '', offer_details: '', status: 'pending' };
export function ProductForm({ id, initial, onSaved, onCancel, returnToWishlist = false }: { id?: string; initial?: Partial<ProductInput> & {category_hint?:string}; onSaved?: () => void; onCancel?: () => void; returnToWishlist?: boolean }) {
  const { colors, styles } = useUI();
  const repo = useProducts();
  // An imported/reviewed category is already part of the user’s draft.
  const manualCategory = useRef(!!initial?.category_id);
  const saveGate = useRef(createSaveGate());
  const submitting = useRef(false);
  const persistedImage = useRef('');
  const [creatingCategory,setCreatingCategory]=useState(false);
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
      if (product) { persistedImage.current=product.image_url; setInput(product); setPrice(product.price_cents === null ? '' : (product.price_cents / 100).toFixed(2).replace('.', ',')); setDesiredPrice(product.desired_price_cents === null ? '' : (product.desired_price_cents / 100).toFixed(2).replace('.', ',')); }
      else {
        setInput({ ...empty, ...initial, category_id: initial?.category_id ?? suggestCategory(initial?.name??'',cats,initial?.category_hint,initial?.description) ?? '' });
        setPrice(initial?.price_cents == null ? '' : (initial.price_cents / 100).toFixed(2).replace('.', ','));
      }
    }).catch(() => { if (alive) setLoadError('Não foi possível carregar o formulário.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [repo, id, retry, initial]);
  async function save() {
    if (busy || submitting.current) return;
    const next = { ...input, name: input.name.trim(), original_url: input.original_url.trim(), image_url: input.image_url.trim() };
    const validation = validateProduct(next);
    if (id && next.image_url===persistedImage.current) delete validation.image_url;
    try { next.price_cents = parsePrice(price); } catch (e) { validation.price_cents = (e as Error).message; }
    try { next.desired_price_cents = parsePrice(desiredPrice); } catch (e) { validation.desired_price_cents = (e as Error).message; }
    if (returnToWishlist && initial?.offer_details && next.price_cents !== initial.price_cents && !validation.price_cents) {
      next.offer_details = initial.offer_details + '\nPreço ajustado manualmente no cadastro: ' + money(next.price_cents) + '. Condições acima preservam a evidência original da importação.';
      if (next.offer_details.length > 10000) validation.offer_details = 'Condições muito extensas. Não foi possível preservar todo o conteúdo.';
    }
    setErrors(validation); setError('');
    if (Object.keys(validation).length) { setDetails(true); setError('Revise os campos destacados abaixo.'); return; }
    submitting.current = true; setBusy(true);
    try { const savedId = await saveGate.current.run(() => repo.save(next, id)); if (!savedId) return; onSaved?.(); if (returnToWishlist) router.replace({ pathname: '/', params: { saved: savedId } }); else router.replace({ pathname: '/products/[id]', params: { id: savedId } }); }
    catch { setError('Não foi possível salvar o desejo. Seus campos foram preservados; tente novamente.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function addCategory() {
    if (busy) return;
    setBusy(true); setError('');
    try { manualCategory.current=true; const categoryId = await repo.addCategory(newCategory); setCategories(await repo.categories()); setInput(v => ({ ...v, category_id: categoryId })); setNewCategory('');setCreatingCategory(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível criar a categoria.'); }
    finally { setBusy(false); }
  }
  function field(key: 'name' | 'original_url' | 'image_url' | 'store' | 'description' | 'personal_notes', label: string, multiline = false) {
    return <View key={key}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} value={input[key]} onChangeText={value => setInput(v => ({ ...v, [key]: value, ...(key==='name'&&!id&&!manualCategory.current?{category_id:suggestCategory(value,categories,initial?.category_hint,v.description)??''}:{}) }))} style={[styles.input, multiline && { minHeight: 110, textAlignVertical: 'top' }, !!errors[key] && { borderColor: colors.error }]} multiline={multiline} autoCapitalize={key.includes('url') ? 'none' : 'sentences'} keyboardType={key.includes('url') ? 'url' : 'default'} maxLength={key === 'name' || key === 'store' ? 160 : key === 'original_url' ? 8192 : key.includes('url') ? 2048 : 10000} placeholderTextColor={colors.muted} />{!!errors[key] && <Text style={styles.error}>{errors[key]}</Text>}</View>;
  }
  if (loading) return <View style={styles.page}><ActivityIndicator color={colors.accent} /></View>;
  if (loadError) return <View style={styles.page}><Text style={styles.error}>{loadError}</Text><Button title="Tentar novamente" onPress={() => setRetry(r => r + 1)} /></View>;
  return <View style={{flex:1}}><KeyboardScrollView showsVerticalScrollIndicator={false} style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.heading}>{id ? 'Seu desejo, do seu jeito' : 'O que você quer conquistar?'}</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!input.image_url && <ProductImage uri={input.image_url} large />}
    <ImageEditor id={id} value={input.image_url} disabled={busy} onSaved={image_url=>{persistedImage.current=image_url;setInput(value=>({...value,image_url}));}}/>
    {field('name', 'Nome do produto *')}
    {!!input.store && <Text style={styles.body}>{input.store}</Text>}
    {!!input.original_url && <Text style={[styles.body,{fontSize:12}]}>O endereço da loja será preservado.</Text>}
    <View><Text style={styles.label}>Categoria</Text><Text style={[styles.body,{fontSize:12}]}>Sugestão local quando reconhecida. Você pode escolher outra categoria.</Text><View style={styles.row}>{categories.map(c => <Chip key={c.id} title={c.name} active={input.category_id === c.id} onPress={() => { if(!busy){manualCategory.current=true;setInput(v=>({...v,category_id:c.id}));} }} />)}</View>{!!errors.category_id && <Text style={styles.error}>{errors.category_id}</Text>}</View>
    <View><Text style={styles.label}>Preço conhecido (R$)</Text><TextInput accessibilityLabel="Preço conhecido" editable={!busy} style={styles.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="1299,90" placeholderTextColor={colors.muted} />{!!errors.price_cents && <Text style={styles.error}>{errors.price_cents}</Text>}</View>
    <View><Text style={styles.label}>Prioridade</Text><View style={styles.row}>{(Object.keys(priorityLabels) as Priority[]).map(p => <Chip key={p} title={priorityLabels[p]} color={{high:colors.priorityHigh,medium:colors.priorityMedium,low:colors.priorityLow}[p]} active={input.priority === p} onPress={() => !busy && setInput(v => ({ ...v, priority: p }))} />)}</View></View>
    <Text style={[styles.body,{fontSize:12}]}>Preço opcional. Ao editar, preserve as condições de pagamento informadas pela loja.</Text>
    <Button title={details ? 'Menos detalhes' : 'Mais detalhes e categorias'} variant="secondary" onPress={() => setDetails(v => !v)} />
    {details && <View style={{ gap: 22 }}>
    <Button title="Criar categoria" disabled={busy} onPress={()=>{setError('');setCreatingCategory(true)}}/>
    {field('original_url','Link do produto (opcional)')}{!id && field('image_url','URL da imagem (opcional)')}
    <View><Text style={styles.label}>Preço desejado (R$)</Text><TextInput accessibilityLabel="Preço desejado" editable={!busy} style={styles.input} keyboardType="decimal-pad" value={desiredPrice} onChangeText={setDesiredPrice} placeholder="999,90" placeholderTextColor={colors.muted} />{!!errors.desired_price_cents && <Text style={styles.error}>{errors.desired_price_cents}</Text>}</View>
    {field('store','Loja')}<DescriptionField value={input.description} onChange={description => setInput(value => ({...value,description}))} editable={!busy} error={errors.description} />{field('personal_notes','Anotações pessoais',true)}
    {!!input.offer_details&&<View><Text style={styles.label}>Ofertas e condições</Text><ExpandableText text={input.offer_details} label="ofertas e condições"/></View>}
    {!!input.notes&&<View><Text style={styles.label}>Texto preservado de versões anteriores</Text><Text style={styles.body}>A origem deste texto não foi classificada automaticamente.</Text><ExpandableText text={input.notes} label="texto anterior"/></View>}
    </View>}
    {onCancel && <Button title="Cancelar edição" variant="secondary" disabled={busy} onPress={onCancel} />}
    <Button title={busy ? 'Salvando…' : 'Salvar desejo'} disabled={busy} onPress={save} />
  </KeyboardScrollView><KeyboardDialog visible={creatingCategory} onClose={()=>{if(!busy)setCreatingCategory(false)}}><View style={styles.card}><Text style={styles.heading}>Nova categoria</Text><TextInput accessibilityLabel="Nome da nova categoria" editable={!busy} style={styles.input} placeholder="Ex.: Livros" placeholderTextColor={colors.muted} value={newCategory} onChangeText={setNewCategory} maxLength={60}/>{!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button title="Salvar categoria" disabled={busy||!newCategory.trim()} onPress={addCategory}/><Button title="Cancelar" variant="secondary" disabled={busy} onPress={()=>{setCreatingCategory(false);setError('')}}/></View></KeyboardDialog></View>;
}
