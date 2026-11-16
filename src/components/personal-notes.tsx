import { usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, useUI } from './ui';
import { Icon } from './brand';
import { ExpandableText } from './expandable-text';
export function PersonalNotes({ value, legacy, onSave, onEditingChange }: { value:string; legacy:string; onSave:(text:string)=>Promise<void>; onEditingChange:(editing:boolean)=>void }) {
  const {styles,colors}=useUI();const [editing,setEditing]=useState(false);const [draft,setDraft]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  usePreventRemove(editing,()=>setError('Salve ou cancele a anotação antes de sair. Seu texto foi mantido.'));
  function open(text=value){onEditingChange(true);setDraft(text);setError('');setEditing(true);}
  async function save(){if(busy)return;setBusy(true);setError('');try{await onSave(draft);setEditing(false);onEditingChange(false);}catch{setError('Não foi possível salvar. Seu texto continua disponível para tentar novamente.');}finally{setBusy(false);}}
  return <View style={{gap:12}}>
    <Pressable accessibilityRole="button" accessibilityLabel="Editar anotações pessoais" disabled={busy||editing} onPress={()=>open()} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:44}}><Text style={styles.heading}>Anotações pessoais</Text><Icon name="edit" color={colors.primary} size={18}/></Pressable>
    {editing?<><TextInput accessibilityLabel="Anotação pessoal" multiline editable={!busy} value={draft} onChangeText={setDraft} maxLength={10000} style={[styles.input,{height:180,textAlignVertical:'top'}]}/>{!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<View style={styles.row}><Button title="Salvar anotação" disabled={busy} onPress={save}/><Button title="Cancelar anotação" variant="secondary" disabled={busy} onPress={()=>{setEditing(false);onEditingChange(false);setDraft('');setError('');}}/></View></>:value?<ExpandableText text={value} label="anotações pessoais"/>:<Button title="Adicionar anotação" variant="secondary" onPress={()=>open()}/>}
    {!!legacy&&<View style={{gap:8,paddingTop:12}}><Text style={styles.label}>Texto preservado de versões anteriores</Text><Text style={styles.body}>Este texto pode misturar informações da loja e anotações. Nada foi apagado ou classificado automaticamente.</Text><ExpandableText text={legacy} label="texto anterior"/>{!editing&&<Button title="Revisar texto anterior nas minhas anotações" variant="secondary" onPress={()=>open([value,legacy].filter(Boolean).join('\n'))}/>}</View>}
  </View>;
}
