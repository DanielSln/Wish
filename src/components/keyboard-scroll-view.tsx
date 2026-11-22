import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Platform, ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keyboardOverlap } from '@/domain/keyboard-layout';
// Reserve only the overlap left AFTER Android's native window resize, never a second keyboard height.
export function KeyboardScrollView({ children, style, contentContainerStyle, onFocus, onBlur, ...props }: ScrollViewProps) {
  const frame=useRef<ComponentRef<typeof View>>(null);const scroll=useRef<ComponentRef<typeof ScrollView>>(null);
  const focused=useRef<Parameters<ComponentRef<typeof ScrollView>['scrollResponderScrollNativeHandleToKeyboard']>[0]|null>(null);
  const keyboardTop=useRef<number|undefined>(undefined);const [overlap,setOverlap]=useState(0);
  const insets=useSafeAreaInsets();
  const reveal=useCallback(()=>{
    if(Platform.OS!=='web'&&focused.current!==null&&Keyboard.isVisible()) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focused.current,16,true);
  },[]);
  const measure=useCallback(()=>{
    if(Platform.OS==='web')return;
    frame.current?.measureInWindow((_x,y,_width,height)=>{
      if(!frame.current)return;
      setOverlap(keyboardOverlap(y,height,keyboardTop.current));
      requestAnimationFrame(reveal);
    });
  },[reveal]);
  useEffect(()=>{
    if(Platform.OS==='web')return;
    const show=Keyboard.addListener('keyboardDidShow',event=>{keyboardTop.current=event.endCoordinates.screenY;measure()});
    const hide=Keyboard.addListener('keyboardDidHide',()=>{keyboardTop.current=undefined;setOverlap(0)});
    keyboardTop.current=Keyboard.metrics()?.screenY;measure();
    return()=>{show.remove();hide.remove()};
  },[measure]);
  return <View ref={frame} collapsable={false} onLayout={measure} style={{flex:1,paddingBottom:overlap}}>
    <ScrollView {...props} ref={scroll} style={[{flex:1},style]} contentContainerStyle={[contentContainerStyle,{paddingBottom:Math.max(44,insets.bottom+16)}]} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" automaticallyAdjustKeyboardInsets={false}
      onFocus={event=>{focused.current=event.target??null;onFocus?.(event);requestAnimationFrame(measure)}} onBlur={event=>{if(focused.current===event.target)focused.current=null;onBlur?.(event)}}>{children}</ScrollView>
  </View>;
}
