import {Image,PixelRatio,Text,View} from 'react-native';
import {useEffect,useState} from 'react';
import {useUI} from './ui';
import {Mark} from './brand';
import {productImagePresentation} from '@/domain/image-layout';
import {imageManager} from '@/images/manager';
import type {ImagePreview} from '@/domain/image-management';
export function ProductImage({uri,large=false,preview,onValid,compact=false}:{uri:string;large?:boolean;preview?:ImagePreview;onValid?:(valid:boolean)=>void;compact?:boolean}){
  const [resolved,setResolved]=useState<{reference:string;image:ImagePreview}|null>(null);
  const [failed,setFailed]=useState('');const [loaded,setLoaded]=useState<{uri:string;width:number;height:number}|null>(null);const [boxWidth,setBoxWidth]=useState(0);
  const {colors,styles}=useUI();const height=large?(compact?200:260):98;
  useEffect(()=>{
    if(preview||!uri)return;
    let active=true;let resource:ImagePreview|null=null;const controller=new AbortController();
    imageManager.display(uri,controller.signal).then(image=>{resource=image;if(active){if(image)setResolved({reference:uri,image});else setFailed(uri);}else image?.release();}).catch(()=>{if(active)setFailed(uri);});
    return()=>{active=false;controller.abort();resource?.release();};
  },[uri,preview]);
  const source=preview??(resolved?.reference===uri?resolved.image:null);const key=source?.uri??uri;
  const current=loaded?.uri===key?loaded:null;const size=current?productImagePresentation(current.width,current.height,boxWidth||98,height,PixelRatio.get(),large):null;
  const frame={height:compact&&large?(size?Math.min(height,size.height):uri?height:120):height,width:large?'100%' as const:98,borderRadius:16,backgroundColor:source&&failed!==key?'transparent':colors.soft};
  return <View style={{width:large?'100%':98,gap:8}}><View onLayout={e=>setBoxWidth(e.nativeEvent.layout.width)} style={[frame,{alignItems:'center',justifyContent:compact&&source?'flex-start':'center',overflow:'hidden'}]}>
    {source&&failed!==key?<Image key={key} accessibilityLabel="Imagem do produto" source={{uri:source.uri}} resizeMode={size?.resizeMode??'contain'} style={size?{width:size.width,height:size.height,borderRadius:16}:{width:'100%',height:'100%'}} onError={()=>{setFailed(key);onValid?.(false);}} onLoad={e=>{const {width,height}=e.nativeEvent.source;const valid=width>0&&height>0&&width*height<=20000000;if(!valid)setFailed(key);else setLoaded({uri:key,width,height});onValid?.(valid);}}/>:<View accessibilityLabel="Imagem indisponível"><Mark size={large?62:38}/></View>}
  </View>{large&&!!uri&&((failed===key)||(!source&&failed===uri))&&<Text style={[styles.body,{fontSize:12}]}>Imagem indisponível. Você pode escolher outra em Alterar imagem.</Text>}{large&&current&&Math.min(current.width,current.height)<300&&<Text style={[styles.body,{fontSize:12}]}>Imagem pequena; preservamos sua proporção sem ampliar demais.</Text>}</View>;
}
