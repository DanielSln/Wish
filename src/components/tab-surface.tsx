import type { ReactNode } from 'react';
import { useIsFocused } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUI } from './ui';
// Kept-alive tabs must not expose offscreen controls to touch or accessibility.
export function TabSurface({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  const focused = useIsFocused(); const { colors, styles } = useUI();
  return <SafeAreaView edges={['top','left','right']} accessibilityElementsHidden={!focused} importantForAccessibility={focused?'auto':'no-hide-descendants'} style={[padded?styles.page:{flex:1,backgroundColor:colors.bg},!focused&&{display:'none'}]}>{children}</SafeAreaView>;
}
