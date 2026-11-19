import { StyleSheet, Text, Pressable, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useAppearance } from '@/theme/provider';
import { palettes, type Palette } from '@/theme/palette';
const buildStyles = (c: Palette) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 24 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 22, paddingTop: 24, paddingBottom: 44 },
  title: { color: c.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  heading: { color: c.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 },
  body: { color: c.muted, fontSize: 15, lineHeight: 23 },
  label: { color: c.text, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, color: c.text, borderRadius: 12, padding: 15, fontSize: 16, minHeight: 52 },
  button: { backgroundColor: c.primary, padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  buttonText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: c.card },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border, gap: 12 },
  error: { color: c.error, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: c.border },
});
const sheets = { light: buildStyles(palettes.light), dark: buildStyles(palettes.dark) };
export function useUI() { const { colors, mode } = useAppearance(); return { colors, styles: sheets[mode] }; }
export function Button({ title, onPress, disabled, style, variant = 'primary' }: { title: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; variant?: 'primary' | 'secondary' | 'danger' }) {
  const { colors: c, styles: s } = useUI();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, variant === 'secondary' && { backgroundColor: c.soft }, variant === 'danger' && { backgroundColor: c.dangerBg }, style, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}><Text style={[s.buttonText, variant === 'secondary' && { color: c.text }, variant === 'danger' && { color: c.error }]}>{title}</Text></Pressable>;
}
export function Chip({ title, active, onPress, color }: { title: string; active?: boolean; color?: string; onPress: () => void }) {
  const { colors: c, styles: s } = useUI();
  const webSelection = Platform.OS === 'web' ? { 'aria-pressed': !!active } : {};
  return <Pressable {...webSelection} accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={[s.chip, active && { backgroundColor: c.soft, borderColor: c.muted }]}><Text style={{ color: color ?? (active ? c.text : c.muted), fontWeight: active ? '600' : '400' }}>{title}</Text></Pressable>;
}
