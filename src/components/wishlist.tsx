import { useCatalogRevision } from '@/data/use-catalog-revision';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { TabSurface } from '@/components/tab-surface';
import { useProducts } from '@/data/use-products';
import { type Category, type Product, type Filters, money, priorityLabels } from '@/domain/product';
import { Button, Chip, useUI } from './ui';
import { ProductImage } from './product-image';
import { Brand, Icon, Mark } from './brand';
const sorts: [NonNullable<Filters['sort']>, string][] = [['newest','Mais recentes'],['oldest','Mais antigos'],['price-asc','Menor preço'],['price-desc','Maior preço'],['priority','Prioridade']];
export function Wishlist({ purchased = false, category }: { purchased?: boolean; category?: string }) {
  const catalogRevision=useCatalogRevision();
  const repo = useProducts(); const { colors:c, styles:s } = useUI();
  const [products,setProducts] = useState<Product[]>([]); const [categories,setCategories] = useState<Category[]>([]);
  const [filters,setFilters] = useState<Filters>({category,sort:'newest'});
  const [loading,setLoading] = useState(true); const [error,setError] = useState(''); const [reload,setReload] = useState(0);
  const [showFilters,setShowFilters] = useState(false);
  useFocusEffect(useCallback(() => {
    void catalogRevision; void reload; let alive=true; setLoading(true);setError('');
    const query = purchased ? {...filters,status:'purchased'} : filters;
    Promise.all([repo.list(query),repo.categories()]).then(([items,cats])=>{if(alive){setProducts(items);setCategories(cats)}}).catch(()=>{if(alive)setError('Não foi possível carregar seus desejos.')}).finally(()=>{if(alive)setLoading(false)});
    return ()=>{alive=false};
  },[repo,filters,purchased,reload,catalogRevision]));
  return <TabSurface><FlatList data={loading||error?[]:products} contentContainerStyle={s.content} keyExtractor={item=>item.id} ListHeaderComponent={<View style={{gap:24}}>
    <View style={[s.row,{justifyContent:'space-between'}]}><Brand /><Text style={{color:c.muted,fontSize:11,letterSpacing:1.4}}>UM DESEJO DE CADA VEZ</Text></View>
    <View style={{gap:8,paddingTop:14}}><Text style={{color:c.primary,fontSize:12,fontWeight:'700',letterSpacing:1.8}}>{purchased?'SUAS CONQUISTAS':'O QUE VEM A SEGUIR'}</Text><Text style={[s.title,{fontSize:36,lineHeight:42}]}>{purchased?'Valeu a espera.':'Espaço para\nseus próximos planos.'}</Text><Text style={s.body}>{purchased?'Tudo o que saiu da lista e entrou na sua vida.':'Guarde o que faz sentido. Compre no seu tempo.'}</Text></View>
    {!purchased&&<Pressable accessibilityRole="button" accessibilityLabel="Adicionar um desejo por link" onPress={()=>router.push('/products/import')} style={{backgroundColor:c.soft,borderRadius:18,padding:20,flexDirection:'row',alignItems:'center',gap:15}}><Icon name="link" color={c.primary} size={26}/><View style={{flex:1,gap:4}}><Text style={[s.heading,{fontSize:16}]}>Encontrou algo especial?</Text><Text style={[s.body,{fontSize:13}]}>Cole o link. A gente organiza o começo.</Text></View><Icon name="arrow" color={c.primary}/></Pressable>}
    <View style={{gap:14}}><View style={[s.row,{justifyContent:'space-between'}]}><Text style={s.heading}>{purchased?'Comprados':'Seus desejos'}</Text><Pressable accessibilityRole="button" accessibilityState={{expanded:showFilters}} onPress={()=>setShowFilters(v=>!v)} style={{paddingVertical:8,paddingLeft:12}}><Text style={{color:c.primary,fontWeight:'600'}}>Filtros e ordem</Text></Pressable></View>
    <TextInput accessibilityLabel="Pesquisar por nome" placeholder="Pesquisar seus desejos" value={filters.search??''} onChangeText={search=>setFilters(f=>({...f,search}))} style={s.input} placeholderTextColor={c.muted}/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}><Chip title="Todas" active={!filters.category} onPress={()=>setFilters(f=>({...f,category:undefined}))}/>{categories.map(cat=><Chip key={cat.id} title={cat.name} active={filters.category===cat.id} onPress={()=>setFilters(f=>({...f,category:cat.id}))}/>)}</ScrollView>
    {showFilters&&<View style={{gap:14}}>{!purchased&&<View style={s.row}>{[['','Todos'],['pending','Pendentes'],['purchased','Comprados']].map(([status,label])=><Chip key={status} title={label} active={(filters.status??'')===status} onPress={()=>setFilters(f=>({...f,status}))}/>)}</View>}<ScrollView horizontal contentContainerStyle={{gap:8}} showsHorizontalScrollIndicator={false}>{sorts.map(([sort,title])=><Chip key={sort} title={title} active={filters.sort===sort} onPress={()=>setFilters(f=>({...f,sort}))}/>)}</ScrollView></View>}
    {loading?<ActivityIndicator color={c.primary}/>:<Text style={[s.body,{fontSize:12}]}>{products.length} {products.length===1?'produto':'produtos'} nesta seleção</Text>}
    {!!error&&<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Tentar novamente" onPress={()=>setReload(v=>v+1)}/></>}
    </View>
  </View>} ListEmptyComponent={!loading&&!error?<View style={{alignItems:'center',gap:14,paddingVertical:38,paddingHorizontal:16}}><Mark size={60}/><Text style={s.heading}>{purchased?'Cada conquista tem seu tempo.':'Sua lista, no seu ritmo.'}</Text><Text style={[s.body,{textAlign:'center'}]}>{purchased?'Quando você marcar um desejo como comprado, ele aparece aqui.':'Nenhum desejo nesta seleção. Comece com uma ideia ou ajuste seus filtros.'}</Text>{!purchased&&<Button title="Adicionar meu primeiro desejo" onPress={()=>router.push('/add')}/>}</View>:undefined} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Ver ${item.name}`} onPress={()=>router.push({pathname:'/products/[id]',params:{id:item.id}})} style={({pressed})=>({flexDirection:'row',gap:18,paddingVertical:22,borderBottomWidth:1,borderBottomColor:c.border,opacity:pressed?0.7:1})}><ProductImage uri={item.image_url}/><View style={{flex:1,gap:7,justifyContent:'center'}}><Text style={{color:c.muted,fontSize:11,fontWeight:'600',letterSpacing:0.6}}>{item.category_name?.toUpperCase()}</Text><Text style={[s.heading,{fontSize:18}]} numberOfLines={2}>{item.name}</Text><Text style={{color:c.primary,fontWeight:'700',fontSize:17}}>{money(item.price_cents)}</Text><Text style={{color:c.muted,fontSize:12}}>{priorityLabels[item.priority]} prioridade · {item.status==='purchased'?'Comprado':'Pendente'}</Text>{!!item.store&&<Text style={{color:c.muted,fontSize:12}}>{item.store}</Text>}</View><Icon name="arrow" color={c.muted} size={18}/></Pressable>}/></TabSurface>;
}
