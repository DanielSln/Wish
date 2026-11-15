import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import * as Network from 'expo-network';
import { useAuth } from '../auth/provider';
import { localStore } from '../data/store';
import { SyncLocal, type Conflict, type Summary } from './local';
import { SyncEngine } from './engine';
import { supabaseRemote } from './remote';
export type BackupContextValue={local:SyncLocal|null;summary:Summary|null;conflicts:Conflict[];busy:boolean;refresh:()=>Promise<void>;sync:()=>Promise<void>;confirm:()=>Promise<void>;resolve:(id:string,choice:'local'|'remote'|'merge_category'|'keep_both',name?:string)=>Promise<void>};
const BackupContext=createContext<BackupContextValue>({local:null,summary:null,conflicts:[],busy:false,refresh:async()=>{},sync:async()=>{},confirm:async()=>{},resolve:async()=>{}});
export function BackupProvider({children,onAssociate}:{children:ReactNode;onAssociate:()=>Promise<void>}){
  const db=useSQLiteContext();const {service,state:auth}=useAuth();
  const local=useMemo(()=>new SyncLocal(localStore(db),randomUUID),[db]);
  const owner=auth.session?.user.id??null;
  const engine=useMemo(()=>service&&owner?new SyncEngine(local,supabaseRemote(service.http,service,owner),owner,service.http.config.url,()=>service.identity===owner&&!service.snapshot.logoutFailed):null,[service,owner,local]);
  const [summary,setSummary]=useState<Summary|null>(null);const [conflicts,setConflicts]=useState<Conflict[]>([]);const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{const [s,c]=await Promise.all([local.summary(),local.conflicts()]);setSummary(s);setConflicts(c)},[local]);
  const sync=useCallback(async()=>{if(!engine)return;setBusy(true);try{await engine.run(true)}finally{setBusy(false);await refresh()}},[engine,refresh]);
  useEffect(()=>{
    let active=true;let foreground=AppState.currentState==='active';let timer:ReturnType<typeof setTimeout>|null=null;
    const update=()=>{if(active)void refresh().catch(()=>{})};
    const run=async()=>{if(!active||!foreground||!engine||service?.snapshot.needsReauth)return;setBusy(true);try{await engine.run()}finally{if(active){setBusy(false);update()}}};
    update();void run();
    const unsubscribe=local.store.subscribe(reason=>{update();if(reason==='catalog'&&active){if(timer)clearTimeout(timer);timer=setTimeout(()=>{void run()},800)}});
    const app=AppState.addEventListener('change',value=>{foreground=value==='active';if(foreground)void run()});
    const network=Network.addNetworkStateListener(value=>{if(value.isConnected&&value.isInternetReachable!==false)void run()});
    const interval=setInterval(()=>{void run()},30000);
    return()=>{active=false;engine?.stop();unsubscribe();app.remove();network.remove();clearInterval(interval);if(timer)clearTimeout(timer)};
  },[local,engine,refresh,service,auth.needsReauth]);
  async function confirm(){
    if(!service||!owner||service.identity!==owner)throw new Error('Entre antes de associar os dados.');
    await local.activate(owner,service.http.config.url);await onAssociate();await sync();
  }
  async function resolve(id:string,choice:'local'|'remote'|'merge_category'|'keep_both',name?:string){await local.resolve(id,choice,name);await sync()}
  return <BackupContext.Provider value={{local,summary,conflicts,busy,refresh,sync,confirm,resolve}}>{children}</BackupContext.Provider>;
}
export const useBackup=()=>useContext(BackupContext);
