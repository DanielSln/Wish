import { Image, PixelRatio, Text, View } from 'react-native';
import { useState } from 'react';
import { useUI } from './ui';
import { Mark } from './brand';
import { fitProductImage } from '@/domain/image-layout';
export function ProductImage({ uri, large = false }: { uri: string; large?: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const { colors, styles } = useUI();
  const height = large ? 260 : 98;
  const frame = { height, width: large ? '100%' as const : 98, borderRadius: 16, backgroundColor: colors.soft };
  if (!uri || failedUri === uri) return <View accessibilityLabel="Produto sem imagem disponível" style={[frame,{alignItems:'center',justifyContent:'center'}]}><Mark size={large ? 62 : 38} /></View>;
  const current = loaded?.uri === uri ? loaded : null;
  const size = current ? fitProductImage(current.width, current.height, boxWidth || 98, height, PixelRatio.get()) : null;
  return <View style={{ width: large ? '100%' : 98, gap: 8 }}>
    <View onLayout={event => setBoxWidth(event.nativeEvent.layout.width)} style={[frame,{alignItems:'center',justifyContent:'center',overflow:'hidden'}]}>
      <Image key={uri} accessibilityLabel="Imagem do produto" source={{ uri }} onError={() => setFailedUri(uri)} onLoad={event => { const { width, height } = event.nativeEvent.source; setLoaded({ uri, width, height }); }} resizeMode="contain" style={size ?? {width:'100%',height:'100%'}} />
    </View>
    {large && current && Math.min(current.width,current.height) < 300 && <Text style={[styles.body,{fontSize:12}]}>Imagem de baixa resolução. Você pode substituir a URL da imagem no formulário.</Text>}
  </View>;
}
