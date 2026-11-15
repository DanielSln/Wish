import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SQLiteProvider, openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '../auth/provider';
import { CatalogProfiles } from './profiles';
import { migrate } from './migrations';
import { state } from '../sync/journal';
import { BackupProvider } from '../sync/provider';
import { Button, useUI } from '../components/ui';
let profiles:Promise<CatalogProfiles>|null=null;
function deviceProfiles(){
  if(!profiles)profiles=(async()=>{
    const db=await openDatabaseAsync('wish-device.db');
    const registry=new CatalogProfiles(db,async file=>{const catalog=await openDatabaseAsync(file,{useNewConnection:true});try{await migrate(catalog);const s=(await state(catalog))!;return {owner_id:s.owner_id,backend:s.backend}}finally{await catalog.closeAsync()}},randomUUID);
    await registry.init();return registry;
  })().catch(error=>{profiles=null;throw error});
  return profiles;
}
export const CatalogFileContext=createContext('wish.db');
export function CatalogProvider({children}:{children:ReactNode}){
  const {state:auth,service}=useAuth();const {styles,colors}=useUI();
  const user=auth.session?.user.id??null;const backend=service?.http.config.url??null;
  const scope=auth.ready?`${backend??''}#${user??'guest'}`:'loading';
  const initialize=useCallback(async(db:Parameters<typeof migrate>[0])=>{await migrate(db);const current=(await state(db))!;if(current.owner_id&&(current.owner_id!==user||current.backend!==backend))throw new Error('Catálogo de outra conta bloqueado.');},[user,backend]);
  const [revision,setRevision]=useState(0);const [selected,setSelected]=useState<{scope:string;file:string;revision:number}|null>(null);const [error,setError]=useState('');
  useEffect(()=>{
    if(!auth.ready)return;let active=true;
    deviceProfiles().then(registry=>registry.select(user&&backend?{userId:user,backend}:null)).then(file=>{if(active){setSelected({scope,file,revision});setError('')}}).catch(()=>{if(active)setError('Não foi possível abrir o catálogo correto. Os arquivos locais foram preservados. Tente novamente.')});
    return()=>{active=false};
  },[auth.ready,scope,user,backend,revision]);
  if(!selected||selected.scope!==scope||selected.revision!==revision)return <View style={[styles.page,{justifyContent:'center',gap:18}]}>{error?<><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Tentar novamente" onPress={()=>{setError('');setRevision(r=>r+1)}}/></>:<ActivityIndicator color={colors.primary}/>}</View>;
  async function associate(){
    if(!user||!backend||service?.identity!==user)throw new Error('Conta alterada.');
    await (await deviceProfiles()).register({userId:user,backend},selected!.file);
  }
  return <CatalogFileContext.Provider value={selected.file}><SQLiteProvider key={selected.file+scope} databaseName={selected.file} options={{useNewConnection:true}} onInit={initialize}><BackupProvider onAssociate={associate}>{children}</BackupProvider></SQLiteProvider></CatalogFileContext.Provider>;
}
