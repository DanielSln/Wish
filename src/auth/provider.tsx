import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { backendConfig } from './config';
import { BackendHttp } from './http';
import { AuthService, type AuthState } from './service';
import { chunkedSecretStore, type SecretBackend } from './secret-store';
let configurationError='';
const config=(()=>{try{return backendConfig(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)}catch{configurationError='A configuração pública do Supabase é inválida. Confira o guia do projeto.';return null}})();
const AuthContext=createContext<{service:AuthService|null;state:AuthState;configurationError:string}>({service:null,state:{ready:true,session:null,needsReauth:false,error:'',logoutFailed:false},configurationError:''});
export function AuthProvider({children}:{children:ReactNode}){
  const service=useMemo(()=>{
    if(!config)return null;
    const backend:SecretBackend=Platform.OS==='web'?{
      get:async key=>typeof window==='undefined'?null:window.sessionStorage.getItem(key),
      set:async(key,value)=>{window.sessionStorage.setItem(key,value)},
      remove:async key=>{window.sessionStorage.removeItem(key)},
    }:{
      get:key=>SecureStore.getItemAsync(key),
      set:(key,value)=>SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
      remove:key=>SecureStore.deleteItemAsync(key),
    };
    return new AuthService(new BackendHttp(config,expoFetch),chunkedSecretStore(backend,'wish.auth.'+new URL(config.url).hostname,randomUUID));
  },[]);
  const [state,setState]=useState<AuthState>(service?.snapshot??{ready:true,session:null,needsReauth:false,error:'',logoutFailed:false});
  useEffect(()=>{if(!service)return;const unsubscribe=service.subscribe(()=>setState(service.snapshot));void service.restore();return unsubscribe;},[service]);
  return <AuthContext.Provider value={{service,state,configurationError}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
