import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {router,useLocalSearchParams,useFocusEffect} from 'expo-router';
import {fetch as expoFetch} from 'expo/fetch';
import {ActivityIndicator,Text,TextInput,View} from 'react-native';
import {ImportPriceSummary} from '@/components/import-price-summary';
import {Disclosure} from '@/components/disclosure';
import {KeyboardScrollView} from '@/components/keyboard-scroll-view';
import {ProductForm} from '@/components/product-form';
import {ProductImage} from '@/components/product-image';
import {ImageEditor} from '@/components/image-editor';
import {Icon} from '@/components/brand';
import {Button,Chip,TextButton,useUI} from '@/components/ui';
import {priorityLabels,type Category,type Priority,type ProductInput} from '@/domain/product';
import {createSaveGate,validateImportDraft} from '@/domain/import-draft';
import {ImportSession} from '@/domain/import-session';
import {useProducts} from '@/data/use-products';
import {importProduct,linkImportPlan} from '@/services/product-import';
import {importFailureMessage} from '@/services/import-messages';
import {sharedLinks} from '@/services/import-links';
const phaseLabels={fetching:'Consultando loja…',reading:'Recebendo informações…',extracting:'Preparando informações…'};
export default function ImportScreen(){
 const {colors,styles}=useUI(),repo=useProducts(),params=useLocalSearchParams<{url?:string}>();
 const [url,setUrl]=useState(typeof params.url==='string'?params.url:''),[choice,setChoice]=useState('');
 const links=useMemo(()=>sharedLinks(url),[url]);
 const selectedUrl=useMemo(()=>links.length===1?links[0]:links.includes(choice)?choice:'',[links,choice]);
 const [flow]=useState(()=>new ImportSession()),state=useSyncExternalStore(flow.subscribe,flow.getSnapshot,flow.getSnapshot);
 const {draft,preview,phase}=state;
 const busy=phase==='fetching'||phase==='reading'||phase==='extracting',saving=phase==='saving'||phase==='saved';
 const [categories,setCategories]=useState<Category[]>([]),[categoryError,setCategoryError]=useState(''),[categoryRetry,setCategoryRetry]=useState(0);
 const [initial,setInitial]=useState<Partial<ProductInput>|null>(null),[errors,setErrors]=useState<Record<string,string>>({});
 const attempted=useRef<string|null>(null),saveGate=useRef(createSaveGate()),submitting=useRef(false);
 let automatic=false;try{automatic=linkImportPlan(selectedUrl).automatic;}catch{}
 useEffect(()=>{let alive=true;repo.categories().then(cats=>{if(alive){setCategories(cats);flow.setCategories(cats);setCategoryError('');}}).catch(()=>{if(alive)setCategoryError('Não foi possível carregar as categorias.');});return()=>{alive=false;};},[repo,flow,categoryRetry]);
 useEffect(()=>{flow.select(selectedUrl);},[flow,selectedUrl]);
 useFocusEffect(useCallback(()=>()=>{flow.cancel('');},[flow]));
 const load=useCallback(async()=>{
   const token=flow.begin();if(!token)return;attempted.current=token.url;
   try{const result=await importProduct(token.url,token.signal,expoFetch,stage=>flow.progress(token,stage));flow.complete(token,result);}catch(e){flow.fail(token,importFailureMessage(e));}
 },[flow]);
 useEffect(()=>{if(initial||!automatic||attempted.current===selectedUrl)return;const timer=setTimeout(()=>{void load();},300);return()=>clearTimeout(timer);},[selectedUrl,automatic,initial,load]);
 function changeUrl(value:string){if(saving||submitting.current)return;const candidates=sharedLinks(value);flow.select(candidates.length===1?candidates[0]:'');attempted.current=null;saveGate.current=createSaveGate();setChoice('');setUrl(value);setErrors({});}
 function edit(){attempted.current=selectedUrl;const value=flow.openEditor();if(value!==null)setInitial(value);}
 async function desire(){
   if(submitting.current)return;const snapshot=flow.beginSave();if(!snapshot)return;submitting.current=true;
   try{
     const id=await saveGate.current.run(async()=>{
       const cats=await repo.categories();setCategories(cats);
       const next={...snapshot,name:snapshot.name.trim()},validation=validateImportDraft(next,cats);setErrors(validation);
       if(Object.keys(validation).length)throw new Error('Complete os campos indicados para desejar.');
       return repo.save(next);
     });
     if(id){flow.saved();router.replace({pathname:'/',params:{saved:id}});}
   }catch(e){flow.saveFailed(e instanceof Error?e.message:'Não foi possível salvar. Seus campos foram preservados.');}
   finally{submitting.current=false;}
 }
 if(initial)return <ProductForm initial={initial} returnToWishlist onSaved={()=>flow.saved()} onCancel={()=>{setInitial(null);flow.closeEditor();}}/>;
 return <KeyboardScrollView showsVerticalScrollIndicator={false} style={styles.page} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,{gap:12,paddingTop:12}]}>
   <Text style={styles.heading}>Um link, um novo desejo</Text>
   <TextInput accessibilityLabel="Link para importar" style={styles.input} value={url} editable={!saving} onChangeText={changeUrl} placeholder="Cole o link da loja" placeholderTextColor={colors.muted} keyboardType="url" autoCapitalize="none" autoCorrect={false} maxLength={16384}/>
   {links.length>1&&<View style={{gap:8}}><Text style={styles.label}>Escolha o link do produto</Text>{links.map(link=><Button key={link} title={link} variant="secondary" disabled={saving} onPress={()=>{flow.select(link);setChoice(link);attempted.current=null;saveGate.current=createSaveGate();setErrors({});}}/>)}</View>}
   {busy&&<View style={{gap:4}}><View style={styles.row}><ActivityIndicator size="small" color={colors.accent}/><Text accessibilityLiveRegion="polite" style={styles.body}>{phaseLabels[phase]}</Text></View><Text style={[styles.body,{fontSize:13}]}>Você pode preencher enquanto buscamos.</Text><TextButton title="Cancelar consulta" onPress={()=>flow.cancel()}/></View>}
   {!!state.message&&<Text accessibilityRole="alert" style={phase==='idle'&&state.message.startsWith('Consulta cancelada')?styles.body:styles.error}>{state.message}</Text>}
   {!!categoryError&&<View><Text style={styles.error}>{categoryError}</Text><TextButton title="Tentar carregar categorias" onPress={()=>setCategoryRetry(v=>v+1)}/></View>}
   {draft&&<View style={{gap:12}}>
     {!!draft.image_url&&<ProductImage uri={draft.image_url} large compact/>}
     <ImageEditor value={draft.image_url} disabled={saving} onSaved={image_url=>flow.edit('image_url',image_url)}/>
     <View><Text style={styles.label}>Nome do produto *</Text><TextInput accessibilityLabel="Nome do produto *" value={draft.name} editable={!saving} style={styles.input} onChangeText={name=>flow.edit('name',name)} placeholder="O que você quer guardar?" placeholderTextColor={colors.muted} maxLength={160}/>{!!errors.name&&<Text style={styles.error}>{errors.name}</Text>}</View>
     <Text style={styles.body}>{draft.store}</Text>
     {preview?<ImportPriceSummary prices={preview.prices}/>:<Text style={styles.body}>Preço e imagem são opcionais.</Text>}
     <View><Text style={styles.label}>Categoria</Text><View style={styles.row}>{categories.map(category=><Chip key={category.id} title={category.name} active={draft.category_id===category.id} onPress={()=>{if(!saving)flow.edit('category_id',category.id);}}/>)}</View>{!!errors.category_id&&<Text style={styles.error}>{errors.category_id}</Text>}{categories.length===0&&!categoryError&&<Text style={styles.body}>Carregando categorias…</Text>}</View>
     <View><Text style={styles.label}>Prioridade</Text><View style={styles.row}>{(Object.keys(priorityLabels) as Priority[]).map(priority=><Chip key={priority} title={priorityLabels[priority]} active={draft.priority===priority} onPress={()=>{if(!saving)flow.edit('priority',priority);}}/>)}</View></View>
     <Button title={saving?'Salvando…':'Desejar'} icon={<Icon name="heart" color={colors.onPrimary} size={20}/>} disabled={saving} onPress={()=>{void desire();}}/>
     <Button title="Editar informações" variant="secondary" icon={<Icon name="edit" size={20}/>} disabled={saving} onPress={edit}/>
     {!!draft.description&&<Disclosure title="Descrição"><Text style={styles.body}>{draft.description}</Text></Disclosure>}
     <Disclosure title="Condições e origem"><Text style={styles.body}>{draft.offer_details}</Text>{preview?.warnings.map(warning=><Text key={warning} style={styles.body}>{warning}</Text>)}</Disclosure>
     {automatic&&!busy&&<TextButton title={preview?'Atualizar informações':'Buscar informações'} disabled={saving} onPress={()=>{void load();}}/>}
     {!automatic&&<Text style={styles.body}>Consulta automática indisponível nesta loja. Complete seu desejo; o link foi preservado.</Text>}
   </View>}
   {!draft&&<Button title="Preencher manualmente" variant="secondary" disabled={saving} onPress={edit}/>}
   <Disclosure title="Sobre a importação"><Text style={styles.body}>Usamos informações públicas disponíveis no link, sem contornar bloqueios. Complete apenas o que faltar. Preços e condições devem ser conferidos na loja. Nada é salvo até tocar em Desejar ou salvar o formulário.</Text></Disclosure>
 </KeyboardScrollView>;
}
