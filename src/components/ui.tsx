import { StyleSheet, Text, Pressable, type StyleProp, type ViewStyle } from 'react-native';
export const colors = { bg: '#101116', card: '#1B1C25', purple: '#BAA0FF', text: '#F6F5F8', muted: '#AAA8B7', border: '#343240', error: '#FFB4BD' };
export function Button({ title, onPress, disabled, style }: { title: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.button, style, disabled && { opacity: 0.5 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
export function Chip({ title, active, onPress }: { title: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={[styles.chip, active && { backgroundColor: '#493467', borderColor: colors.purple }]}><Text style={{ color: active ? '#F0E7FF' : colors.muted }}>{title}</Text></Pressable>;
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 22 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 18, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 20, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  label: { color: colors.text, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text, borderRadius: 14, padding: 14, fontSize: 16, minHeight: 50 },
  button: { backgroundColor: colors.purple, padding: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#1A102C', fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: colors.card },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
});
