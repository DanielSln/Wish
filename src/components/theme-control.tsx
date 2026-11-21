import { Platform, Pressable, Text, View } from 'react-native';
import type { AppearancePreference } from '@/theme/palette';
import { Icon, type IconName } from './brand';
import { useUI } from './ui';
const options: {value:AppearancePreference;label:string;icon:IconName}[]=[{value:'light',label:'Claro',icon:'sun'},{value:'dark',label:'Escuro',icon:'moon'},{value:'system',label:'Automático',icon:'system'}];
export function ThemeControl({ value, onChange, disabled }: { value:AppearancePreference; onChange:(value:AppearancePreference)=>void; disabled:boolean }) {
  const {colors}=useUI();
  return <View accessibilityLabel="Aparência do Wish" style={{flexDirection:'row',flexWrap:'wrap',gap:4,padding:4,borderRadius:14,backgroundColor:colors.soft}}>{options.map(option=>{
    const selected=value===option.value;
    return <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{selected,disabled}} {...(Platform.OS==='web'?{'aria-pressed':selected}:{})} disabled={disabled} onPress={()=>onChange(option.value)} style={{flexGrow:1,flexBasis:110,minWidth:110,minHeight:66,paddingVertical:8,paddingHorizontal:6,gap:4,alignItems:'center',justifyContent:'center',borderRadius:10,borderWidth:2,borderColor:selected?colors.primary:'transparent',backgroundColor:selected?colors.card:'transparent',opacity:disabled?0.6:1}}><Icon name={option.icon} size={21}/><Text style={{color:colors.text,fontSize:14,fontWeight:selected?'700':'400',textAlign:'center',width:'100%',maxWidth:'100%',flexShrink:1}}>{option.label}</Text></Pressable>;
  })}</View>;
}
