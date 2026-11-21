import {PixelRatio,Text,View} from 'react-native';
import {Image} from 'expo-image';
import {useEffect,useState} from 'react';
import {useUI} from './ui';
import {Mark} from './brand';
import {productImagePresentation,imageLoadDimensions} from '@/domain/image-layout';
import {imageManager} from '@/images/manager';
import type {ImagePreview} from '@/domain/image-management';
export function ProductImage({uri,large=false,preview,onValid,compact=false,thumbnailSize=98}:{uri:string;thumbnailSize?:number;large?:boolean;preview?:ImagePreview;onValid?:(valid:boolean)=>void;compact?:boolean}){
  const [resolved,setResolved]=useState<{reference:string;image:ImagePreview}|null>(null);
  const [failed,setFailed]=useState('');const [loaded,setLoaded]=useState<{uri:string;width:number;height:number}|null>(null);const [boxWidth,setBoxWidth]=useState(0);
  const {colors,styles}=useUI();const height=large?(compact?200:260):thumbnailSize;
  useEffect(()=>{
    if(preview||!uri)return;
    let active=true;let resource:ImagePreview|null=null;const controller=new AbortController();
    imageManager.display(uri,controller.signal).then(image=>{resource=image;if(active){if(image)setResolved({reference:uri,image});else setFailed(uri);}else image?.release();}).catch(()=>{if(active)setFailed(uri);});
    return()=>{active=false;controller.abort();resource?.release();};
  },[uri,preview]);
  const source=preview??(resolved?.reference===uri?resolved.image:null);const key=source?.uri??uri;
  const current=loaded?.uri===key?loaded:null;const size=current?productImagePresentation(current.width,current.height,boxWidth||thumbnailSize,height,PixelRatio.get(),large):null;
  const frame={height:compact&&large?(size?Math.min(height,size.height):uri?height:120):height,width:large?'100%' as const:thumbnailSize,borderRadius:16,backgroundColor:source&&failed!==key?'transparent':colors.soft};
  return <View style={{width:large?'100%':thumbnailSize,gap:8}}><View onLayout={e=>setBoxWidth(e.nativeEvent.layout.width)} style={[frame,{alignItems:'center',justifyContent:compact&&source?'flex-start':'center',overflow:'hidden'}]}>
    {source&&failed!==key?<Image key={key} accessible accessibilityLabel="Imagem do produto" source={{uri:source.uri}} contentFit={size?.resizeMode??'contain'} style={size?{width:size.width,height:size.height,borderRadius:16}:{width:'100%',height:'100%'}} onError={()=>{setFailed(key);onValid?.(false);}} onLoad={e=>{const dimensions=imageLoadDimensions(e);if(!dimensions)setFailed(key);else setLoaded(previous=>previous?.uri===key&&previous.width===dimensions.width&&previous.height===dimensions.height?previous:{uri:key,...dimensions});onValid?.(dimensions!==null);}}/>:<View accessibilityLabel="Imagem indisponível"><Mark size={large?62:38}/></View>}
  </View>{large&&!!uri&&((failed===key)||(!source&&failed===uri))&&<Text style={[styles.body,{fontSize:12}]}>Imagem indisponível. Você pode escolher outra em Alterar imagem.</Text>}{large&&current&&Math.min(current.width,current.height)<300&&<Text style={[styles.body,{fontSize:12}]}>Imagem pequena; preservamos sua proporção sem ampliar demais.</Text>}</View>;
}
