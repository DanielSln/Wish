import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { fetch as expoFetch } from 'expo/fetch';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { ImportPriceSummary } from '@/components/import-price-summary';
import { Disclosure } from '@/components/disclosure';
import { KeyboardScrollView } from '@/components/keyboard-scroll-view';
import { ProductForm } from '@/components/product-form';
import { ProductImage } from '@/components/product-image';
import { Icon } from '@/components/brand';
import { Button, Chip, useUI } from '@/components/ui';
import { priorityLabels, type Category, type Priority, type ProductInput } from '@/domain/product';
import { createSaveGate, importDraft, validateImportDraft } from '@/domain/import-draft';
import { useProducts } from '@/data/use-products';
import { importProduct, manualProductFromLink, linkImportPlan, importDestination, type ImportPreview } from '@/services/product-import';

export default function ImportScreen() {
  const { colors, styles } = useUI();
  const repo = useProducts();
  const params = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(typeof params.url === 'string' ? params.url : '');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [draft, setDraft] = useState<ProductInput | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [initial, setInitial] = useState<Partial<ProductInput> | null>(null);
  const [manualNotice, setManualNotice] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const active = useRef<AbortController | null>(null);
  const saveGate = useRef(createSaveGate());
  const submitting = useRef(false);
  const attempted = useRef<string | null>(null);
  let manualOnly = false;
  try { manualOnly = !linkImportPlan(url).automatic; } catch {}
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  const load = useCallback(async (automatic = false) => {
    if (active.current) return;
    try {
      if (!linkImportPlan(url).automatic) {
        if (automatic) return;
        setInitial(manualProductFromLink(url));
        setManualNotice('Complete os dados. O link da loja foi preservado.');
        return;
      }
    } catch { /* The import validator explains invalid addresses. */ }
    let candidate = url.trim();
    try { candidate = importDestination(url); } catch {}
    if (automatic && attempted.current === candidate) return;
    attempted.current = candidate;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(''); setErrors({}); setPreview(null); setDraft(null);
    try {
      const result = await importProduct(url, controller.signal, expoFetch);
      const cats = await repo.categories();
      if (active.current === controller) {
        setCategories(cats); setPreview(result); setDraft(importDraft(result.product, cats));
        saveGate.current = createSaveGate();
      }
    } catch (e) {
      if (active.current === controller) setError(e instanceof Error ? e.message : 'Não foi possível importar este link.');
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }, [url, repo]);
  useEffect(() => {
    if (initial || preview) return;
    try { importDestination(url); } catch { return; }
    const timer = setTimeout(() => { void load(true); }, 900);
    return () => clearTimeout(timer);
  }, [url, load, initial, preview]);
  function manual() {
    let value: Partial<ProductInput> = {};
    try { value = manualProductFromLink(url); } catch {}
    setManualNotice(value.original_url ? 'O link da loja foi preservado.' : 'Preencha seu desejo manualmente.');
    setInitial(value);
  }
  async function desire() {
    if (!draft || submitting.current) return;
    submitting.current = true;
    try {
      const savedId = await saveGate.current.run(async () => {
        setSaving(true); setError('');
        const cats = await repo.categories();
        setCategories(cats);
        const next = { ...draft, name: draft.name.trim() };
        const validation = validateImportDraft(next, cats);
        setErrors(validation);
        if (Object.keys(validation).length) throw new Error('Complete os campos indicados. Você também pode editar as informações.');
        return repo.save(next);
      });
      if (savedId) router.replace({ pathname: '/', params: { saved: savedId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar. Seus dados foram preservados.');
    } finally { submitting.current = false; setSaving(false); }
  }
  if (initial) return <View style={{ flex: 1 }}>{!!manualNotice && <Text style={[styles.body, { padding: 12, paddingBottom: 0 }]}>{manualNotice}</Text>}<ProductForm initial={initial} returnToWishlist onCancel={() => { setInitial(null); setManualNotice(''); }} /></View>;
  return <KeyboardScrollView showsVerticalScrollIndicator={false} style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { gap: 12, paddingTop: 12 }]}>
    <Text style={styles.heading}>Um link, um novo desejo</Text>
    <TextInput accessibilityLabel="Link para importar" style={styles.input} value={url} editable={!busy && !saving} onChangeText={value => { attempted.current = null; setUrl(value); setPreview(null); setDraft(null); setError(''); setErrors({}); }} placeholder="https://loja.com.br/produto" placeholderTextColor={colors.muted} keyboardType="url" autoCapitalize="none" autoCorrect={false} maxLength={2048} />
    {!preview && <Button title={busy ? 'Consultando loja…' : manualOnly ? 'Continuar cadastro' : 'Buscar informações'} disabled={busy || saving || !url.trim()} onPress={() => { void load(); }} />}
    {busy && <><ActivityIndicator color={colors.accent} /><Button title="Cancelar consulta" onPress={() => { active.current?.abort(); active.current = null; setBusy(false); }} /></>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {preview && draft && <View style={styles.card}>
      <ProductImage uri={draft.image_url} large compact />
      {(!preview.product.name || errors.name) ? <View><Text style={styles.label}>Nome do produto *</Text><TextInput accessibilityLabel="Nome do produto *" editable={!saving} style={styles.input} value={draft.name} onChangeText={name => setDraft(value => value && ({ ...value, name }))} maxLength={160} placeholderTextColor={colors.muted} />{!!errors.name && <Text style={styles.error}>{errors.name}</Text>}</View> : <Text style={styles.heading}>{draft.name}</Text>}
      <Text style={styles.body}>{draft.store}</Text>
      <ImportPriceSummary prices={preview.prices} />
      <View><Text style={styles.label}>Categoria</Text><View style={styles.row}>{categories.map(category => <Chip key={category.id} title={category.name} active={draft.category_id === category.id} onPress={() => { if (!saving) setDraft(value => value && ({ ...value, category_id: category.id })); }} />)}</View>{!draft.category_id && <Text style={styles.body}>Selecione uma categoria para desejar.</Text>}{!!errors.category_id && <Text style={styles.error}>{errors.category_id}</Text>}{categories.length === 0 && <Text style={styles.body}>Crie uma categoria em Editar informações.</Text>}</View>
      <View><Text style={styles.label}>Prioridade</Text><View style={styles.row}>{(Object.keys(priorityLabels) as Priority[]).map(priority => <Chip key={priority} title={priorityLabels[priority]} active={draft.priority === priority} onPress={() => { if (!saving) setDraft(value => value && ({ ...value, priority })); }} />)}</View></View>
      <Button title={saving ? 'Salvando…' : 'Desejar'} icon={<Icon name="heart" color={colors.onPrimary} size={20} />} disabled={saving} onPress={() => { void desire(); }} />
      <Button title="Editar informações" variant="secondary" icon={<Icon name="edit" size={20} />} disabled={saving} onPress={() => { setManualNotice(''); setInitial({ ...draft }); }} />
      {!!draft.description && <Disclosure title="Descrição"><Text style={styles.body}>{draft.description}</Text></Disclosure>}
      <Disclosure title="Condições e origem"><Text style={styles.body}>{draft.offer_details}</Text>{preview.warnings.map(warning => <Text key={warning} style={styles.body}>{warning}</Text>)}</Disclosure>
    </View>}
    {!preview && <Button title="Preencher manualmente" variant="secondary" disabled={busy || saving} onPress={manual} />}
    <Disclosure title="Sobre a importação"><Text style={styles.body}>Usamos os dados públicos disponíveis na loja, sem contornar bloqueios. Valores anunciados podem depender de pagamento, cupom e elegibilidade. Nada é salvo até tocar em Desejar ou salvar o formulário. Se a consulta falhar, continue manualmente com o link preservado.</Text></Disclosure>
  </KeyboardScrollView>;
}
