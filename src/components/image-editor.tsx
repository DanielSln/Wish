import {SafeAreaView} from 'react-native-safe-area-context';
import {Icon} from './brand';
import {useEffect,useRef,useState} from 'react';
import {Modal,Platform,Pressable,ScrollView,Text,TextInput} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {Button,useUI} from './ui';
import {ProductImage} from './product-image';
import {imageManager} from '@/images/manager';
import {remoteImageUrl,imageErrorMessage,type ImagePreview} from '@/domain/image-management';
import {useProducts} from '@/data/use-products';
const friendly=(error:unknown,fallback:string)=>error instanceof Error&&/^(Escolha|A imagem|O seletor|Arquivo|O produto)/.test(error.message)?error.message:fallback;
type Draft={kind:'local';bytes:Uint8Array;preview:ImagePreview}|{kind:'remote';url:string;preview:ImagePreview}|{kind:'remove'};
export function ImageEditor({id,value,onSaved,disabled}:{id?:string;value:string;onSaved:(value:string)=>void;disabled?:boolean}){
 const {styles,colors}=useUI();const repo=useProducts();const [open,setOpen]=useState(false);const [url,setUrl]=useState('');const [draft,setDraft]=useState<Draft|null>(null);const [valid,setValid]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const resource=useRef<ImagePreview|null>(null);const alive=useRef(true);const lock=useRef(false);const abort=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;abort.current?.abort();resource.current?.release();};},[]);
 function choose(next:Draft){resource.current?.release();resource.current=next.kind==='remove'?null:next.preview;setValid(next.kind==='remove');setDraft(next);setError('');}
 function close(){if(lock.current)return;abort.current?.abort();resource.current?.release();resource.current=null;setDraft(null);setOpen(false);setError('');setUrl('');setValid(false);}
 async function gallery(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,allowsMultipleSelection:false,quality:0.9,base64:false,exif:false});
  if(result.canceled)return;
  const asset=result.assets[0];if(asset.width*asset.height>20000000)throw new Error('Escolha uma foto de até 20 megapixels.');
  const next=await imageManager.local(asset.uri);if(!alive.current){next.preview.release();return;}choose({kind:'local',...next});
 }catch(e){if(alive.current)setError(friendly(e,'Não foi possível abrir essa foto. Tente outra imagem.'));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function previewUrl(){if(lock.current)return;lock.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;try{const address=remoteImageUrl(url.trim());const preview=await imageManager.remote(address,controller.signal);if(!alive.current){preview.release();return;}choose({kind:'remote',url:address,preview});}catch(error){if(alive.current)setError(imageErrorMessage(error,Platform.OS==='web'));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function save(){if(!draft||!valid||lock.current)return;lock.current=true;setBusy(true);setError('');try{const reference=draft.kind==='local'?await imageManager.persist(draft.bytes):draft.kind==='remote'?draft.url:'';if(id)await repo.saveImage(id,reference,value);if(alive.current)onSaved(reference);lock.current=false;if(alive.current)close();}catch(e){if(alive.current)setError(friendly(e,'Não foi possível salvar; a imagem anterior foi preservada.'));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 return <><Pressable accessibilityRole="button" accessibilityLabel={value?'Alterar imagem':'Adicionar imagem'} accessibilityState={{disabled:!!disabled}} disabled={disabled} onPress={()=>setOpen(true)} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,padding:12,opacity:disabled?0.5:1}}><Icon name="image" size={19} color={colors.primary}/><Text style={{color:colors.primary,fontWeight:'600'}}>{value?'Alterar imagem':'Adicionar imagem'}</Text></Pressable><Modal visible={open} animationType="slide" onRequestClose={close}><SafeAreaView style={{flex:1,backgroundColor:colors.bg}}><ScrollView style={styles.page} contentContainerStyle={[styles.content,{paddingTop:32}]} keyboardShouldPersistTaps="handled"><Text style={styles.heading}>Imagem do desejo</Text><Text style={styles.body}>{id?'Só a imagem será alterada. Confira a prévia e salve para confirmar.':'Escolha a imagem. O produto será cadastrado ao salvar o desejo.'}</Text><Text style={[styles.body,{fontSize:12}]}>JPEG, PNG, WebP ou GIF · até 8 MB e 20 megapixels. Fotos da galeria ficam neste aparelho.</Text>
 <ProductImage uri={draft?.kind==='remove'?'':value} preview={draft&&draft.kind!=='remove'?draft.preview:undefined} large onValid={value=>{if(draft&&draft.kind!=='remove'&&resource.current?.uri===draft.preview.uri){setValid(value);if(!value)setError('O arquivo foi recebido, mas não pôde ser exibido como imagem. Use outro arquivo ou link.');}}}/>
 {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 {Platform.OS!=='web'?<Button title="Escolher da galeria" variant="secondary" disabled={busy} onPress={gallery}/>:<Text style={styles.body}>Para fotos da galeria, use o Expo Go no celular.</Text>}
 <Text style={styles.label}>Link direto da imagem</Text><Text style={[styles.body,{fontSize:12}]}>Cole o endereço do arquivo da foto, não o link de uma loja ou página de busca. Redirecionamentos não são seguidos.</Text><TextInput accessibilityLabel="Link direto da imagem" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} style={styles.input} placeholder="https://site.com/foto.jpg" placeholderTextColor={colors.muted} value={url} onChangeText={text=>{setUrl(text);if(draft?.kind==='remote'){resource.current?.release();resource.current=null;setDraft(null);setValid(false);}}} editable={!busy}/>
 <Button title="Ver prévia do link" variant="secondary" disabled={busy||!url.trim()} onPress={previewUrl}/>
 {!!value&&<Button title="Remover imagem" variant="secondary" disabled={busy} onPress={()=>choose({kind:'remove'})}/>}
 {draft?.kind==='remove'&&<Text style={styles.body}>O produto ficará sem imagem após salvar.</Text>}
 <Button title={busy?'Aguarde…':'Salvar imagem'} disabled={busy||!draft||!valid} onPress={save}/><Button title="Cancelar" variant="secondary" disabled={busy} onPress={close}/>
 </ScrollView></SafeAreaView></Modal></>;
}
