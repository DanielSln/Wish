import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/auth/provider';
import { CatalogProvider } from '@/data/catalog-provider';
import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button, useUI } from '@/components/ui';
import { AppearanceProvider, useAppearance } from '@/theme/provider';
function DatabaseError({ retry }: { retry: () => void }) {
  const { styles } = useUI();
  return <View style={[styles.page,{justifyContent:'center',gap:18}]}><Text style={styles.title}>Não foi possível abrir o banco</Text><Text style={styles.body}>Seus dados foram preservados. Tente novamente. No navegador, use um contexto seguro com suporte a SQLite.</Text><Button title="Tentar novamente" onPress={retry} /></View>;
}
class DatabaseBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <DatabaseError retry={() => this.setState({ failed:false })} /> : this.props.children; }
}
function Navigation() {
  const { colors, mode } = useAppearance();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return <ThemeProvider value={{...base,colors:{...base.colors,background:colors.bg,card:colors.card,text:colors.text,border:colors.border,primary:colors.primary}}}><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerStyle:{backgroundColor:colors.bg},headerTintColor:colors.text,contentStyle:{backgroundColor:colors.bg},headerShadowVisible:false,headerBackTitle:'Voltar' }}>
    <Stack.Screen name="(tabs)" options={{headerShown:false}} />
    <Stack.Screen name="products/import" options={{title:'Adicionar por link'}} />
    <Stack.Screen name="products/new" options={{title:'Novo desejo'}} />
    <Stack.Screen name="products/[id]" options={{title:'Seu desejo'}} />
    <Stack.Screen name="products/edit" options={{title:'Editar desejo'}} />
  </Stack></ThemeProvider>;
}
export default function RootLayout() {
  return <DatabaseBoundary><AuthProvider><CatalogProvider><AppearanceProvider><Navigation /></AppearanceProvider></CatalogProvider></AuthProvider></DatabaseBoundary>;
}
