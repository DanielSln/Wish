import { useEffect, useRef, useState } from 'react';
import { fetch as expoFetch } from 'expo/fetch';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { ProductForm } from '@/components/product-form';
import { ProductImage } from '@/components/product-image';
import { Button, colors, styles } from '@/components/ui';
import { money, type ProductInput } from '@/domain/product';
import { importProduct, importUrl, type ImportPreview } from '@/services/product-import';

export default function ImportScreen() {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [initial, setInitial] = useState<Partial<ProductInput> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  async function load() {
    if (active.current) return;
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
  }
  function manual() {
    let original_url = '';
    try { original_url = importUrl(url); } catch { /* Invalid links must not block manual entry. */ }
    setInitial({ original_url });
  }
  if (initial) return <ProductForm initial={initial} />;
  return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.heading}>Um link, um novo desejo</Text>
    <Text style={styles.body}>Cole o link HTTPS de um produto. A consulta acessa a loja pela sua conexão e usa apenas os metadados que ela disponibilizar. Nada é salvo até você revisar e confirmar.</Text>
    <Text style={styles.body}>Consulta automática habilitada para endereços diretos da Amazon Brasil, Mercado Livre, Magalu, KaBuM! e Casas Bahia. Para outras lojas ou links encurtados, use o cadastro manual.</Text>
    <TextInput accessibilityLabel="Link para importar" style={styles.input} value={url} editable={!busy} onChangeText={value => { setUrl(value); setPreview(null); setError(''); }} placeholder="https://loja.com.br/produto" placeholderTextColor={colors.muted} keyboardType="url" autoCapitalize="none" autoCorrect={false} maxLength={2048} />
    <Button title={busy ? 'Consultando loja…' : 'Buscar informações'} disabled={busy || !url.trim()} onPress={load} />
    {busy && <><ActivityIndicator color={colors.purple} /><Button title="Cancelar consulta" onPress={() => { active.current?.abort(); active.current = null; setBusy(false); }} /></>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {preview && <View style={styles.card}>
      <Text style={styles.heading}>Prévia do produto</Text>
      <ProductImage uri={preview.product.image_url} large />
      <Text style={styles.heading}>{preview.product.name}</Text>
      <Text style={styles.body}>{preview.product.store}</Text>
      <Text style={styles.body}>{money(preview.product.price_cents)}</Text>
      {!!preview.product.description && <Text style={styles.body}>{preview.product.description}</Text>}
      <Text selectable style={styles.body}>{preview.product.original_url}</Text>
      {preview.warnings.map(warning => <Text key={warning} style={styles.body}>{warning}</Text>)}
      <Button title="Revisar e escolher categoria" onPress={() => setInitial(preview.product)} />
    </View>}
    <Text style={styles.body}>Algumas lojas exigem login, carregam os dados por JavaScript ou bloqueiam consultas. Nesses casos, use o cadastro manual. Não há contorno de bloqueios ou atualização automática de preço.</Text>
    <Button title="Preencher manualmente" disabled={busy} onPress={manual} />
  </ScrollView>;
}
