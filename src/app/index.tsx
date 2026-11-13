import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProducts } from '@/data/use-products';
import { type Category, type Product, type Filters, money, priorityLabels } from '@/domain/product';
import { Button, Chip, colors, styles } from '@/components/ui';
import { ProductImage } from '@/components/product-image';
const sorts: [NonNullable<Filters['sort']>, string][] = [['newest','Mais recentes'], ['oldest','Mais antigos'], ['price-asc','Menor preço'], ['price-desc','Maior preço'], ['priority','Prioridade']];
export default function HomeScreen() {
  const repo = useProducts();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<Filters>({ sort: 'newest' });
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => {
    void reload; let alive = true;
    setLoading(true); setError('');
    Promise.all([repo.list(filters), repo.categories()]).then(([items, cats]) => { if (alive) { setProducts(items); setCategories(cats); } }).catch(() => { if (alive) setError('Não foi possível carregar seus desejos. Tente novamente.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [repo, filters, reload]));
  return <SafeAreaView style={styles.page}><FlatList contentContainerStyle={styles.content} data={loading || error ? [] : products} keyExtractor={p => p.id} ListHeaderComponent={<View style={{ gap: 18 }}>
    <View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={styles.title}>wish<Text style={{ color: colors.purple }}>.</Text></Text><Button title="+ Novo desejo" onPress={() => router.push('/products/new')} /></View>
    <Text style={styles.body}>Seus próximos planos, um desejo de cada vez.</Text>
    <TextInput accessibilityLabel="Pesquisar por nome" placeholder="Pesquisar por nome…" placeholderTextColor={colors.muted} style={styles.input} value={filters.search ?? ''} onChangeText={search => setFilters(f => ({ ...f, search }))} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}><Chip title="Todas" active={!filters.category} onPress={() => setFilters(f => ({ ...f, category: undefined }))} />{categories.map(c => <Chip key={c.id} title={c.name} active={filters.category === c.id} onPress={() => setFilters(f => ({ ...f, category: c.id }))} />)}</ScrollView>
    <View style={styles.row}>{[['','Todos'],['pending','Pendentes'],['purchased','Comprados']].map(([status, label]) => <Chip key={status} title={label} active={(filters.status ?? '') === status} onPress={() => setFilters(f => ({ ...f, status }))} />)}</View>
    <Text style={styles.label}>Ordenar por</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{sorts.map(([sort, title]) => <Chip key={sort} title={title} active={filters.sort === sort} onPress={() => setFilters(f => ({ ...f, sort }))} />)}</ScrollView>
    {loading ? <ActivityIndicator color={colors.purple} /> : <Text style={styles.body}>{products.length} desejo(s) nesta seleção</Text>}
    {!!error && <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Tentar novamente" onPress={() => setReload(r => r + 1)} /></>}
  </View>} ListEmptyComponent={!loading && !error ? <View style={styles.card}><Text style={styles.heading}>Espaço para seus planos</Text><Text style={styles.body}>Nenhum produto nesta seleção. Cadastre um desejo ou ajuste os filtros.</Text></View> : undefined} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${item.name}`} onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })} style={[styles.card, { flexDirection: 'row' }]}><ProductImage uri={item.image_url} /><View style={{ flex: 1, gap: 6 }}><Text style={styles.heading}>{item.name}</Text><Text style={styles.body}>{item.category_name}{item.store ? ` · ${item.store}` : ''}</Text><Text style={{ color: colors.purple, fontWeight: '700' }}>{money(item.price_cents)}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Prioridade {priorityLabels[item.priority].toLowerCase()} · {item.status === 'purchased' ? 'Comprado' : 'Pendente'}</Text></View></Pressable>} /></SafeAreaView>;
}
