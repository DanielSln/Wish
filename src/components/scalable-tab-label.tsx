import { Platform, Text, View, type ColorValue } from 'react-native';
import { useTheme } from 'expo-router';
import { labelExtraHeight } from './tab-label-layout';
// Web text-only enlargement (including the CSS regression) doesn't change RN's
// fontScale. Measure one inert single line, independently of wrapped label height.
export function TabFontProbe({onMeasure}:{onMeasure:(height:number)=>void}) {
  const {fonts}=useTheme();
  if(Platform.OS!=='web')return null;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{position:'absolute',width:'100%',height:0,overflow:'hidden',opacity:0}}><Text testID="tab-font-probe" accessible={false} allowFontScaling numberOfLines={1} onLayout={event=>onMeasure(event.nativeEvent.layout.height)} style={[fonts.medium,{position:'absolute',left:0,fontSize:10,fontWeight:'600'}]}>Ag</Text></View>;
}
export function ScalableTabLabel({title,color,position,itemWidth,scaled,onMeasure}:{title:string;color:ColorValue|null;position:'below-icon'|'beside-icon';itemWidth:number;scaled:boolean;onMeasure:(title:string,extra:number)=>void}) {
  const {fonts}=useTheme();const beside=position==='beside-icon';
  return <Text testID={'tab-label-'+title} accessible={false} allowFontScaling numberOfLines={scaled?undefined:1} onLayout={event=>onMeasure(title,labelExtraHeight(event.nativeEvent.layout.height,position))} style={[fonts.medium,{color:color??undefined,fontSize:10,fontWeight:'600',backgroundColor:'transparent',textAlign:'center'},beside?{marginStart:5,marginEnd:12,lineHeight:scaled?undefined:24}:undefined,scaled?(beside?{flexShrink:0,maxWidth:Math.max(1,itemWidth-58)}:{flexShrink:0,width:itemWidth,marginHorizontal:-5}):undefined]}>{title}</Text>;
}
