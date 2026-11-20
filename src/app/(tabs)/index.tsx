import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Wishlist } from '@/components/wishlist';
import { useUI } from '@/components/ui';
export default function Home() {
  const { category, saved } = useLocalSearchParams<{ category?: string; saved?: string }>();
  const selected = typeof category === 'string' ? category : undefined;
  const [dismissed, setDismissed] = useState<string | null>(null);
  const { styles, colors } = useUI();
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => { setDismissed(saved); }, 3500);
    return () => clearTimeout(timer);
  }, [saved]);
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>{!!saved && saved !== dismissed && <Text accessibilityLiveRegion="polite" style={[styles.body, { paddingHorizontal: 24, paddingVertical: 8 }]}>Desejo salvo.</Text>}<Wishlist key={selected ?? 'all'} category={selected} /></View>;
}
