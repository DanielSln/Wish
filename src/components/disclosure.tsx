import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUI } from './ui';
export function Disclosure({ title, children, initiallyOpen=false }: { title:string; children:ReactNode; initiallyOpen?:boolean }) {
  const [open,setOpen]=useState(initiallyOpen);const {styles,colors}=useUI();
  return <View style={{gap:open?8:0}}><Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{expanded:open}} aria-expanded={open} onPress={()=>setOpen(v=>!v)} style={{minHeight:48,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:12}}><Text style={[styles.heading,{fontSize:16,flex:1}]}>{title}</Text><Text style={{color:colors.primary,fontSize:16}}>{open?'−':'+'}</Text></Pressable>{open&&children}</View>;
}
