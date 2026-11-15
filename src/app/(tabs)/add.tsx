import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { TabSurface } from '@/components/tab-surface';
import { Button, useUI } from '@/components/ui';
import { Brand, Icon } from '@/components/brand';
import { ProductForm } from '@/components/product-form';
export default function Add() {
  const {colors:c,styles:s}=useUI(); const [name,setName]=useState(''); const [initial,setInitial]=useState<{name:string}|null>(null);
  if(initial)return <TabSurface padded={false}><View style={{padding:24}}><Button variant="secondary" title="Escolher outra forma de adicionar" onPress={()=>setInitial(null)}/></View><ProductForm initial={initial} onSaved={()=>{setInitial(null);setName('')}}/></TabSurface>;
  return <TabSurface><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Brand/><View style={{gap:10,paddingTop:14}}><Text style={s.title}>O próximo desejo.</Text><Text style={s.body}>Comece pelo que você já tem: um link ou uma ideia.</Text></View><View style={{backgroundColor:c.soft,borderRadius:20,padding:24,gap:16}}><Icon name="link" color={c.primary} size={30}/><Text style={s.heading}>Tem um link?</Text><Text style={s.body}>Busque nome, imagem, preço e loja, quando disponíveis. Revise tudo antes de salvar.</Text><Button title="Adicionar por link" onPress={()=>router.push('/products/import')}/></View><View style={{gap:16,paddingVertical:10}}><Icon name="search" color={c.primary} size={28}/><Text style={s.heading}>Tem um nome em mente?</Text><TextInput accessibilityLabel="Nome para começar" style={s.input} placeholder="O que você quer guardar?" placeholderTextColor={c.muted} value={name} onChangeText={setName} maxLength={160}/><Text style={[s.body,{fontSize:13}]}>Sugestões automáticas por nome ainda não estão disponíveis. Você pode começar com esse nome e preencher o restante.</Text><Button title="Continuar com esse nome" disabled={!name.trim()} onPress={()=>setInitial({name:name.trim()})}/></View><Button variant="secondary" title="Preencher manualmente" onPress={()=>router.push('/products/new')}/></ScrollView></TabSurface>;
}
