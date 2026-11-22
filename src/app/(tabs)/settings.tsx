import {router} from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TabSurface } from '@/components/tab-surface';
import { useAppearance } from '@/theme/provider';
import type { AppearancePreference } from '@/theme/palette';
import { Button, useUI } from '@/components/ui';
import { ThemeControl } from '@/components/theme-control';
import { Brand } from '@/components/brand';
export default function Settings() {
  const {styles:s}=useUI();const {preference,setPreference,error:loadError}=useAppearance();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function select(next:AppearancePreference){if(busy)return;setBusy(true);setError('');try{await setPreference(next)}catch{setError('Não foi possível salvar a aparência. Tente novamente.')}finally{setBusy(false)}}
  return <TabSurface><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content,{gap:12,paddingTop:12}]}><Brand/><View style={{gap:10,paddingVertical:6}}><Text style={s.heading}>Aparência</Text><Text style={s.body}>Siga o tema do aparelho ou escolha o que prefere.</Text><ThemeControl value={preference} onChange={select} disabled={busy}/>{!!(error||loadError)&&<Text accessibilityRole="alert" style={s.error}>{error||loadError}</Text>}</View><View style={s.divider}/><View style={{gap:8,paddingTop:4}}><Button title="Backup e recuperação" variant="secondary" onPress={()=>router.push('/backup')}/><Text style={s.heading}>Sobre o Wish</Text><Text style={s.body}>Uma lista pessoal para guardar desejos e planejar compras com mais intenção.</Text><Text style={s.body}>Seus produtos ficam neste aparelho e funcionam offline. Links de lojas e imagens remotas precisam de internet.</Text><Text style={s.body}>Wish · versão 1.0.0</Text></View></ScrollView></TabSurface>;
}
