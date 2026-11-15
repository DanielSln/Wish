import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TabSurface } from '@/components/tab-surface';
import { useAppearance } from '@/theme/provider';
import type { AppearancePreference } from '@/theme/palette';
import { useUI, Chip } from '@/components/ui';
import { Brand, Mark } from '@/components/brand';
export default function Settings() {
  const {styles:s}=useUI();const {preference,setPreference,error:loadError}=useAppearance();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function select(next:AppearancePreference){if(busy)return;setBusy(true);setError('');try{await setPreference(next)}catch{setError('Não foi possível salvar a aparência. Tente novamente.')}finally{setBusy(false)}}
  return <TabSurface><ScrollView contentContainerStyle={s.content}><Brand/><View style={{gap:8,paddingTop:14}}><Text style={s.title}>Do seu jeito.</Text><Text style={s.body}>Pequenas escolhas para deixar o Wish mais seu.</Text></View><View style={{gap:14,paddingVertical:18}}><Text style={s.heading}>Aparência</Text><Text style={s.body}>Siga o tema do aparelho ou escolha o que prefere.</Text><View style={s.row}>{([['system','Automático'],['light','Claro'],['dark','Escuro']] as const).map(([value,label])=><Chip key={value} title={label} active={preference===value} onPress={()=>select(value)}/>)}</View>{!!(error||loadError)&&<Text accessibilityRole="alert" style={s.error}>{error||loadError}</Text>}</View><View style={s.divider}/><View style={{gap:16,paddingTop:18}}><Mark size={58}/><Text style={s.heading}>Sobre o Wish</Text><Text style={s.body}>Uma lista pessoal para guardar desejos e planejar compras com mais intenção.</Text><Text style={s.body}>Seus produtos ficam neste aparelho e funcionam offline. Links de lojas e imagens remotas precisam de internet.</Text><Text style={s.body}>Wish · versão 1.0.0</Text><Text style={s.body}>Menos impulso. Mais conquistas.</Text></View></ScrollView></TabSurface>;
}
