import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.brand}>wish<Text style={styles.dot}>.</Text></Text>
        <Text style={styles.eyebrow}>SEUS PRÓXIMOS PLANOS</Text>
        <Text style={styles.title}>Todo desejo começa{ '\n' }com uma ideia.</Text>
        <Text style={styles.subtitle}>Um lugar para organizar o que você quer e planejar suas próximas conquistas.</Text>
        <View style={styles.card}>
          <Text style={styles.symbol}>✦</Text>
          <Text style={styles.cardTitle}>Sua lista começa aqui</Text>
          <Text style={styles.cardText}>Em breve, seus produtos favoritos, links e metas vão ganhar um lugar especial.</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>Um desejo de cada vez</Text></View>
        </View>
        <Text style={styles.footer}>Menos impulso. Mais conquistas.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101116' },
  content: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', padding: 28, justifyContent: 'center' },
  brand: { color: '#F6F5F8', fontSize: 44, fontWeight: '800', marginBottom: 48 },
  dot: { color: '#BAA0FF' },
  eyebrow: { color: '#BAA0FF', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  title: { color: '#F6F5F8', fontSize: 34, fontWeight: '700', lineHeight: 42 },
  subtitle: { color: '#A5A4B1', fontSize: 16, lineHeight: 25, marginTop: 16 },
  card: { backgroundColor: '#1A1B23', borderColor: '#30303E', borderWidth: 1, borderRadius: 24, padding: 26, marginTop: 32 },
  symbol: { color: '#BAA0FF', fontSize: 36, marginBottom: 18 },
  cardTitle: { color: '#F6F5F8', fontSize: 21, fontWeight: '600' },
  cardText: { color: '#A5A4B1', fontSize: 15, lineHeight: 24, marginTop: 10 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#302840', borderRadius: 30, paddingHorizontal: 14, paddingVertical: 9, marginTop: 24 },
  badgeText: { color: '#D9C9FF', fontSize: 12, fontWeight: '600' },
  footer: { color: '#777583', fontSize: 12, textAlign: 'center', marginTop: 32 },
});
