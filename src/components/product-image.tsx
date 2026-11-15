import { Image, View } from 'react-native';
import { useState } from 'react';
import { useUI } from './ui';
import { Mark } from './brand';
export function ProductImage({ uri, large = false }: { uri: string; large?: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const { colors } = useUI();
  const height = large ? 260 : 98;
  const frame = { height, width: large ? '100%' as const : 98, borderRadius: 16, backgroundColor: colors.soft };
  if (!uri || failedUri === uri) return <View accessibilityLabel="Produto sem imagem disponível" style={[frame,{alignItems:'center',justifyContent:'center'}]}><Mark size={large ? 62 : 38} /></View>;
  return <Image accessibilityLabel="Imagem do produto" source={{ uri }} onError={() => setFailedUri(uri)} resizeMode="contain" style={frame} />;
}
