import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { Component, type ReactNode } from 'react';
import { Text, View, Pressable } from 'react-native';
import { migrate } from '@/data/migrations';
import { styles } from '@/components/ui';

class DatabaseBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <View style={[styles.page, { justifyContent: 'center' }]}><Text style={styles.title}>Não foi possível abrir o banco</Text><Text style={styles.body}>Seus dados não foram apagados. Tente novamente. No navegador, use um contexto seguro com suporte a SQLite.</Text><Pressable style={styles.button} onPress={() => this.setState({ failed: false })}><Text style={styles.buttonText}>Tentar novamente</Text></Pressable></View>;
    return this.props.children;
  }
}
export default function RootLayout() {
  return <ThemeProvider value={DarkTheme}><StatusBar style="light" /><DatabaseBoundary><SQLiteProvider databaseName="wish.db" onInit={migrate}><Stack screenOptions={{ headerStyle: { backgroundColor: '#101116' }, headerTintColor: '#F6F5F8', contentStyle: { backgroundColor: '#101116' }, headerBackTitle: 'Voltar' }}><Stack.Screen name="index" options={{ headerShown: false }} /><Stack.Screen name="products/new" options={{ title: 'Novo desejo' }} /><Stack.Screen name="products/[id]" options={{ title: 'Detalhes' }} /><Stack.Screen name="products/edit" options={{ title: 'Editar desejo' }} /></Stack></SQLiteProvider></DatabaseBoundary></ThemeProvider>;
}
