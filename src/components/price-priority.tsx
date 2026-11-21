import { Text, View } from 'react-native';
import { money, type Priority } from '@/domain/product';
import { PriorityBadge } from './priority-badge';
import { useUI } from './ui';
export function PricePriority({ price, priority, detail=false }: { price:number|null; priority:Priority; detail?:boolean }) {
  const { colors, styles } = useUI();
  return <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,minWidth:0}}>
    <Text selectable={detail} style={price===null ? styles.body : {color:detail?colors.text:colors.primary,fontWeight:'700',fontSize:detail?28:19,flexShrink:1,maxWidth:'100%'}}>{price===null?'Preço não informado':money(price)}</Text>
    <View style={{flexDirection:'row',alignItems:'center',gap:8,maxWidth:'100%'}}><Text accessible={false} style={{color:colors.muted}}>·</Text><PriorityBadge priority={priority}/></View>
  </View>;
}
