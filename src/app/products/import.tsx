import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { fetch as expoFetch } from 'expo/fetch';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { ImportPriceSummary } from '@/components/import-price-summary';
import { Disclosure } from '@/components/disclosure';
import { KeyboardScrollView } from '@/components/keyboard-scroll-view';
import { ProductForm } from '@/components/product-form';
import { ExpandableText } from '@/components/expandable-text';
import { ProductImage } from '@/components/product-image';
import { Button, useUI } from '@/components/ui';
import { money, type ProductInput } from '@/domain/product';
import { importProduct, manualProductFromLink, linkImportPlan, importDestination, type ImportPreview } from '@/services/product-import';

export default function ImportScreen() {
  const { colors, styles } = useUI();
  const params = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(typeof params.url === 'string' ? params.url : '');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [initial, setInitial] = useState<Partial<ProductInput> | null>(null);
  const [manualNotice,setManualNotice]=useState('');
  let manualOnly=false;try{manualOnly=!linkImportPlan(url).automatic;}catch{}
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  const attempted = useRef<string | null>(null);
  const load = useCallback(async (automatic = false) => {
    if (active.current) return;
    try{if(!linkImportPlan(url).automatic){setInitial(manualProductFromLink(url));setManualNotice('Complete os dados do desejo. O endereço e o domínio da loja foram preservados, sem consulta automática a um destino não verificado.');return;}}catch{/* The existing validator explains invalid addresses. */}
    let candidate = url.trim();
    try { candidate = importDestination(url); } catch { /* The explicit action explains unsupported/invalid links below. */ }
    if (automatic && attempted.current === candidate) return;
    attempted.current = candidate;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(''); setPreview(null);
    try {
      const result = await importProduct(url, controller.signal, expoFetch);
      if (active.current === controller) setPreview(result);
    } catch (e) {
      if (active.current === controller) setError(e instanceof Error ? e.message : 'Não foi possível importar este link.');
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }, [url]);
  useEffect(() => {
    if (initial) return;
    try { importDestination(url); } catch { return; }
    const timer = setTimeout(() => { void load(true); }, 900);
    return () => clearTimeout(timer);
  }, [url, load, initial]);
  function manual() {
    let draft: Partial<ProductInput> = {};
    try { draft = manualProductFromLink(url); } catch { /* An invalid link must not prevent entering a new product manually. */ }
    setManualNotice(draft.original_url ? 'Complete os dados do desejo. O link da loja foi preservado.' : 'Você pode cadastrar manualmente sem usar o endereço inválido.');
    setInitial(draft);
  }
  if (initial) return <View style={{flex:1}}>{!!manualNotice&&<Text style={[styles.body,{padding:12,paddingBottom:0}]}>{manualNotice}</Text>}<ProductForm initial={initial} /></View>;
  return <KeyboardScrollView showsVerticalScrollIndicator={false} style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,{gap:12,paddingTop:12}]}>
    <Text style={styles.heading}>Um link, um novo desejo</Text>
    <Disclosure title="Como funciona a importação"><Text style={styles.body}>Cole o link HTTPS de um produto. A consulta acessa a loja pela sua conexão e usa apenas os metadados que ela disponibilizar. A prévia é consultada automaticamente após você colar um link compatível. Nada é salvo até você revisar e confirmar.</Text>
    <Text style={styles.body}>Você pode salvar desejos de qualquer loja com endereço HTTPS válido. A prévia automática usa domínios revisados, incluindo Youcom e links meli.la do Mercado Livre. Nas demais lojas, continue preenchendo os dados com o link preservado.</Text></Disclosure>
    <Text style={styles.body}>Prévia automática pela sua conexão; nada é salvo sem revisão.</Text>
    <TextInput accessibilityLabel="Link para importar" style={styles.input} value={url} editable={!busy} onChangeText={value => { attempted.current = null; setUrl(value); setPreview(null); setError(''); }} placeholder="https://loja.com.br/produto" placeholderTextColor={colors.muted} keyboardType="url" autoCapitalize="none" autoCorrect={false} maxLength={2048} />
    <Button title={busy ? 'Consultando loja…' : manualOnly ? 'Continuar cadastro' : 'Buscar informações'} disabled={busy || !url.trim()} onPress={() => load()} />
    {manualOnly&&<Text style={styles.body}>A prévia automática não está disponível para este endereço neste cliente. O cadastro continua disponível.</Text>}
    {busy && <><ActivityIndicator color={colors.accent} /><Button title="Cancelar consulta" onPress={() => { active.current?.abort(); active.current = null; setBusy(false); }} /></>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {preview && <View style={styles.card}>
      <Text style={styles.heading}>Prévia do produto</Text>
      <ProductImage uri={preview.product.image_url} large compact />
      <Text style={styles.heading}>{preview.product.name || 'Informe o nome na revisão'}</Text>
      <Text style={styles.body}>{preview.product.store}</Text>
      <ImportPriceSummary prices={preview.prices}/>
      {preview.prices.conditional && <Button variant="secondary" title="Revisar usando o preço PIX" onPress={() => { const option = preview.prices.conditional!; setInitial({...preview.product,price_cents:option.price_cents,offer_details:(preview.product.offer_details??'')+'\nPreço escolhido na revisão: '+money(option.price_cents)+' — '+option.label+'. Confira as condições na loja.'}); }}/>}
      {preview.prices.coupon && <View style={{gap:8}}><Text style={styles.label}>Cupom anunciado: {preview.prices.coupon.code}</Text>{preview.prices.coupon.percent !== null && <Text style={styles.body}>{preview.prices.coupon.percent}% de desconto anunciado.</Text>}{preview.prices.coupon.amount_cents !== null && <Text style={styles.body}>{money(preview.prices.coupon.amount_cents)} de desconto anunciado.</Text>}{preview.prices.coupon.price_cents !== null && <Text style={styles.body}>Preço anunciado com cupom: {money(preview.prices.coupon.price_cents)} — sujeito às condições.</Text>}<Text style={styles.body}>{preview.prices.coupon.conditions}</Text><Text style={styles.body}>Nenhum cupom foi aplicado. Na revisão, você pode informar manualmente o preço com cupom confirmado por você.</Text></View>}
      {!!preview.product.description && <ExpandableText text={preview.product.description} />}
      <Text style={styles.body}>Origem: {new URL(preview.product.original_url).hostname}</Text>
      {preview.warnings.map(warning => <Text key={warning} style={styles.body}>{warning}</Text>)}
      <Button title="Revisar e escolher categoria" onPress={() => setInitial(preview.product)} />
    </View>}
    <Text style={styles.body}>Algumas lojas exigem login, carregam os dados por JavaScript ou bloqueiam consultas. Nesses casos, use o cadastro manual. Não há contorno de bloqueios ou atualização automática de preço.</Text>
    <Button title="Preencher manualmente" disabled={busy} onPress={manual} />
  </KeyboardScrollView>;
}
