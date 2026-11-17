import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useUI } from './ui';
const COLLAPSED_LINES = 4;
function MeasuredText({ text, label }: { text: string; label: string }) {
  const { styles, colors } = useUI();
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const overflows = collapsedHeight > 0 && fullHeight > collapsedHeight + 1;
  return <View>
    {/* Measure the same unabridged text at the same width/font. The clipped, zero-height
        wrapper keeps measurement out of scrolling, touch and accessibility trees. */}
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 0, overflow: 'hidden', opacity: 0 }}>
      <Text accessible={false} style={[styles.body, { position: 'absolute', left: 0, right: 0, top: 0, flexShrink: 0 }]} onLayout={e => setFullHeight(e.nativeEvent.layout.height)}>{text}</Text>
    </View>
    <Text testID="expandable-text-content" selectable style={styles.body} numberOfLines={expanded ? undefined : COLLAPSED_LINES} ellipsizeMode="tail" onLayout={e => { if (!expanded) setCollapsedHeight(e.nativeEvent.layout.height); }}>{text}</Text>
    {overflows && <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Ver menos' : 'Ver mais'}: ${label}`} accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(value => !value)} style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{expanded ? 'Ver menos' : 'Ver mais...'}</Text>
    </Pressable>}
  </View>;
}
export function ExpandableText({ text, label = 'descrição' }: { text: string; label?: string }) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  if (!text) return null;
  // A new value, width or font scale gets a fresh collapsed measurement. No substring,
  // trim or other mutation is used: line breaks and the complete value remain intact.
  return <View onLayout={e => setWidth(Math.round(e.nativeEvent.layout.width * 2) / 2)}>
    <MeasuredText key={`${width}:${fontScale}:${text}`} text={text} label={label} />
  </View>;
}
