import { Text, View, type ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useUI } from './ui';
export type IconName = 'home' | 'categories' | 'add' | 'purchased' | 'settings' | 'link' | 'search' | 'arrow';
const symbols = {
  home: { ios: 'house', android: 'home', web: 'home' },
  categories: { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  purchased: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  settings: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  link: { ios: 'link', android: 'link', web: 'link' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  arrow: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
} as const;
export function Icon({ name, color, size = 23 }: { name: IconName; color?: ColorValue | null; size?: number }) {
  const { colors } = useUI();
  return <SymbolView name={symbols[name]} size={size} tintColor={color ?? colors.text} />;
}
export function Mark({ size = 44 }: { size?: number }) {
  const { colors } = useUI();
  const points = [[12,17],[22,47],[32,27],[42,47],[52,17]];
  const scale = size / 64;
  return <View accessibilityLabel="Símbolo W do Wish" style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: colors.accent }}>
    {points.slice(0,-1).map(([x,y], i) => {
      const [nextX,nextY] = points[i+1]; const length = Math.hypot(nextX-x,nextY-y);
      return <View key={i} style={{ position:'absolute', backgroundColor: colors.accentText, height: 6*scale, width:length*scale+2*scale, borderRadius:3*scale, left:((x+nextX)/2-length/2-1)*scale, top:((y+nextY)/2-3)*scale, transform:[{rotate:`${Math.atan2(nextY-y,nextX-x)*180/Math.PI}deg`}] }} />;
    })}
  </View>;
}
export function Brand() {
  const { colors } = useUI();
  return <View style={{ flexDirection:'row',alignItems:'center',gap:11 }}><Mark size={36} /><Text style={{ color:colors.text,fontSize:26,fontWeight:'700',letterSpacing:-1 }}>Wish</Text></View>;
}
