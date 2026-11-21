import { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { ScalableTabLabel, TabFontProbe } from '@/components/scalable-tab-label';
import { navigationBarHeight } from '@/components/tab-label-layout';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/brand';
import { useUI } from '@/components/ui';
export default function TabLayout() {
  const { colors } = useUI();
  const insets = useSafeAreaInsets();
  const {width,height,fontScale}=useWindowDimensions();
  const itemWidth=Math.max(1,(width-2*Math.max(insets.left,insets.right))/5);
  const [webLineHeight,setWebLineHeight]=useState(14);
  const measureFont=useCallback((height:number)=>setWebLineHeight(previous=>Math.abs(previous-height)<0.05?previous:height),[]);
  const scaled=fontScale>1||webLineHeight>14.1;
  const layoutKey=[width,height,fontScale,insets.left,insets.right,scaled].join(':');
  const [measurements,setMeasurements]=useState<{key:string;extras:Record<string,number>}>({key:'',extras:{}});
  const report=useCallback((title:string,extra:number)=>{
    setMeasurements(previous=>{
      const extras=previous.key===layoutKey?previous.extras:{};
      if(extras[title]!==undefined&&Math.abs(extras[title]-extra)<0.5)return previous;
      return {key:layoutKey,extras:{...extras,[title]:extra}};
    });
  },[layoutKey]);
  const extra=scaled?Math.max(0,(fontScale-1)*16,...Object.values(measurements.key===layoutKey?measurements.extras:{})):0;
  return <><TabFontProbe onMeasure={measureFont}/><Tabs screenOptions={{ headerShown:false, tabBarActiveTintColor:colors.primary,tabBarInactiveTintColor:colors.muted,tabBarStyle:{backgroundColor:colors.card,borderTopColor:colors.border,elevation:0,height:navigationBarHeight(extra,insets.bottom),paddingTop:6,paddingBottom:Math.max(10,insets.bottom)},tabBarAllowFontScaling:true,tabBarLabelPosition:scaled?'below-icon':undefined,tabBarLabel:({color,position,children})=><ScalableTabLabel key={layoutKey+children+position} title={children} color={color} position={position} itemWidth={itemWidth} scaled={scaled} onMeasure={report}/>,tabBarIconStyle:extra>0?{marginBottom:6}:undefined,tabBarItemStyle:{paddingTop:0} }}>
    <Tabs.Screen name="index" options={{title:'Início',tabBarAccessibilityLabel:'Início',tabBarIcon:({color})=><Icon name="home" color={color} />}} />
    <Tabs.Screen name="categories" options={{title:'Categorias',tabBarAccessibilityLabel:'Categorias',tabBarIcon:({color})=><Icon name="categories" color={color} />}} />
    <Tabs.Screen name="add" options={{title:'Adicionar',tabBarAccessibilityLabel:'Adicionar',tabBarIcon:({color})=><Icon name="add" color={color} />}} />
    <Tabs.Screen name="purchased" options={{title:'Comprados',tabBarAccessibilityLabel:'Comprados',tabBarIcon:({color})=><Icon name="purchased" color={color} />}} />
    <Tabs.Screen name="settings" options={{title:'Configurações',tabBarAccessibilityLabel:'Configurações',tabBarIcon:({color})=><Icon name="settings" color={color} />}} />
  </Tabs></>;
}
