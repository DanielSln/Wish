import { Image, Text, View } from 'react-native';
import { useState } from 'react';
import { colors } from './ui';
export function ProductImage({ uri, large = false }: { uri: string; large?: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const height = large ? 240 : 100;
  if (!uri || failedUri === uri) return <View accessibilityLabel="Produto sem imagem disponível" style={{ height, width: large ? '100%' : 90, borderRadius: 16, backgroundColor: '#30283F', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.purple, fontSize: 36 }}>✦</Text></View>;
  return <Image accessibilityLabel="Imagem do produto" source={{ uri }} onError={() => setFailedUri(uri)} resizeMode="contain" style={{ height, width: large ? '100%' : 90, borderRadius: 16, backgroundColor: '#25232C' }} />;
}
