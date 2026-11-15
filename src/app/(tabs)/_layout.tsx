import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/brand';
import { useUI } from '@/components/ui';
export default function TabLayout() {
  const { colors } = useUI();
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown:false, tabBarActiveTintColor:colors.primary,tabBarInactiveTintColor:colors.muted,tabBarStyle:{backgroundColor:colors.card,borderTopColor:colors.border,elevation:0,height:72+insets.bottom,paddingTop:6,paddingBottom:Math.max(10,insets.bottom)},tabBarLabelStyle:{fontSize:10,fontWeight:'600'},tabBarItemStyle:{paddingTop:0} }}>
    <Tabs.Screen name="index" options={{title:'Início',tabBarIcon:({color})=><Icon name="home" color={color} />}} />
    <Tabs.Screen name="categories" options={{title:'Categorias',tabBarIcon:({color})=><Icon name="categories" color={color} />}} />
    <Tabs.Screen name="add" options={{title:'Adicionar',tabBarIcon:({color})=><Icon name="add" color={color} />}} />
    <Tabs.Screen name="purchased" options={{title:'Comprados',tabBarIcon:({color})=><Icon name="purchased" color={color} />}} />
    <Tabs.Screen name="settings" options={{title:'Configurações',tabBarIcon:({color})=><Icon name="settings" color={color} />}} />
  </Tabs>;
}
