import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { TabSurface } from '@/components/tab-surface';
import { useProducts } from '@/data/use-products';
import type { Category } from '@/domain/product';
import { Button, useUI } from '@/components/ui';
import { KeyboardDialog } from '@/components/keyboard-dialog';
import { Brand, Icon } from '@/components/brand';
export default function Categories() {
  const repo=useProducts();const {colors:c,styles:s}=useUI();
  const [categories,setCategories]=useState<Category[]>([]);const [counts,setCounts]=useState<Record<string,number>>({});
  const [creating,setCreating]=useState(false);const [name,setName]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [reload,setReload]=useState(0);
  const [target,setTarget]=useState<Category|null>(null);const [action,setAction]=useState<'rename'|'delete'>('rename');const [renamed,setRenamed]=useState('');
  useFocusEffect(useCallback(()=>{
    void reload; let alive=true;setLoading(true);setError('');
    Promise.all([repo.categories(),repo.list({status:'pending'})]).then(([cats,items])=>{if(alive){setCategories(cats);setCounts(items.reduce<Record<string,number>>((all,p)=>({...all,[p.category_id]:(all[p.category_id]??0)+1}),{}))}}).catch(()=>{if(alive)setError('Não foi possível carregar as categorias.')}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[repo,reload]));
  async function create() {
    if(busy)return;setBusy(true);setError('');
    try {await repo.addCategory(name);setName('');setCreating(false);setReload(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Não foi possível criar a categoria.')}finally{setBusy(false)}
  }
  async function change() {
    if(!target||busy)return;setBusy(true);setError('');
    try {if(action==='rename')await repo.renameCategory(target.id,renamed);else await repo.removeCategory(target.id);setTarget(null);setReload(v=>v+1)}catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar a categoria.')}finally{setBusy(false)}
  }
  function open(cat:Category,next:'rename'|'delete'){setTarget(cat);setAction(next);setRenamed(cat.name);setError('')}
  return <TabSurface><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content,{gap:12,paddingTop:12}]} keyboardShouldPersistTaps="handled"><Brand/><View style={{gap:4,paddingTop:0}}><Text style={[s.title,{fontSize:24,lineHeight:30}]}>Cada ideia no seu lugar.</Text></View>
    {!!error&&!target&&!creating&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {loading?<ActivityIndicator color={c.primary}/>:categories.map(cat=><View key={cat.id} style={{borderBottomWidth:1,borderBottomColor:c.border,paddingVertical:10,gap:4}}><Pressable accessibilityRole="button" accessibilityLabel={`Ver produtos de ${cat.name}`} onPress={()=>router.push({pathname:'/',params:{category:cat.id}})} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4,minHeight:52}}><View style={{backgroundColor:c.soft,padding:10,borderRadius:12}}><Icon name="categories" color={c.primary}/></View><View style={{flex:1,gap:5}}><Text style={s.heading}>{cat.name}</Text><Text style={s.body}>{counts[cat.id]??0} produtos</Text></View><Icon name="arrow" color={c.primary}/></Pressable><View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel={`Renomear ${cat.name}`} onPress={()=>open(cat,'rename')} style={{paddingHorizontal:10,minHeight:44,justifyContent:'center'}}><Text style={{color:c.primary,fontWeight:'600'}}>Renomear</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Excluir categoria ${cat.name}`} onPress={()=>open(cat,'delete')} style={{paddingHorizontal:10,minHeight:44,justifyContent:'center'}}><Text style={{color:c.error}}>Excluir</Text></Pressable></View></View>)}
    {!loading&&!categories.length&&<Text style={s.body}>Um novo começo. Crie sua primeira categoria abaixo.</Text>}
    <Button title="Criar categoria" onPress={()=>{setError('');setCreating(true)}}/>
  </ScrollView><KeyboardDialog visible={!!target} onClose={()=>{if(!busy)setTarget(null)}}><View style={[s.card,{gap:20}]}><Text style={s.heading}>{action==='rename'?'Renomear categoria':`Excluir ${target?.name??'categoria'}?`}</Text>{action==='rename'?<TextInput accessibilityLabel="Novo nome da categoria" style={s.input} value={renamed} onChangeText={setRenamed} maxLength={60} editable={!busy}/>:<Text style={s.body}>Produtos pendentes e comprados precisam ser movidos ou excluídos antes. Seus produtos não serão apagados por esta ação.</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title={action==='rename'?'Salvar nome':'Confirmar exclusão da categoria'} variant={action==='delete'?'danger':'primary'} disabled={busy||(action==='rename'&&!renamed.trim())} onPress={change}/><Button title="Cancelar" variant="secondary" disabled={busy} onPress={()=>{setTarget(null);setError('')}}/></View></KeyboardDialog><KeyboardDialog visible={creating} onClose={()=>{if(!busy)setCreating(false)}}><View style={s.card}><Text style={s.heading}>Uma categoria sua</Text><TextInput accessibilityLabel="Nome da nova categoria" value={name} onChangeText={setName} maxLength={60} editable={!busy} placeholder="Ex.: Livros, viagens, hobbies" placeholderTextColor={c.muted} style={s.input}/>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title="Salvar categoria" onPress={create} disabled={busy||!name.trim()}/><Button title="Cancelar" variant="secondary" disabled={busy} onPress={()=>{setCreating(false);setError('')}}/></View></KeyboardDialog></TabSurface>;
}
