import type { BackendConfig } from './config.ts';
import { SyncError } from '../sync/types.ts';
export type HttpFetch = (url:string,init:RequestInit)=>Promise<Response>;
export class BackendHttp {
  constructor(readonly config:BackendConfig, readonly request:HttpFetch){}
  async call(path:string, body:unknown, token?:string, signal?:AbortSignal):Promise<unknown>{
    const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    const timer=setTimeout(abort,20000);
    try{
      const request=this.request;
      const response=await request(this.config.url+path,{method:'POST',credentials:'omit',redirect:'error',signal:controller.signal,headers:{apikey:this.config.key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(response.redirected||response.status>=300&&response.status<400)throw new SyncError('O projeto devolveu um redirecionamento inesperado.','invalid');
      if(!response.ok){
        if(response.status===401)throw new SyncError('A sessão expirou. Entre novamente para continuar o backup.','auth');
        if(response.status===403)throw new SyncError('O projeto recusou a operação. Verifique as políticas e permissões.','permission');
        if(response.status===429||response.status>=500){const raw=response.headers.get('retry-after');const retry=raw?(Number.isFinite(Number(raw))?Number(raw)*1000:Math.max(0,Date.parse(raw)-Date.now())):0;throw new SyncError('Servidor temporariamente indisponível. As alterações foram preservadas.','network',Number.isFinite(retry)?Math.min(retry,300000):0);}
        throw new SyncError('O projeto recusou os dados. Confira o código de e-mail ou a configuração/migração do Supabase.','invalid');
      }
      if(response.status===204)return null;
      const max=8_000_000;if(Number(response.headers.get('content-length'))>max)throw new SyncError('Resposta do projeto acima do limite.','invalid');
      const reader=response.body?.getReader();if(!reader)throw new SyncError('Resposta do projeto indisponível.','invalid');
      const buffer=new Uint8Array(max);let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;if(size+value.byteLength>max)throw new SyncError('Resposta do projeto acima do limite.','invalid');buffer.set(value,size);size+=value.byteLength;}const text=new TextDecoder().decode(buffer.subarray(0,size));try{return text?JSON.parse(text):null}catch{throw new SyncError('Resposta JSON inválida do projeto.','invalid');}}
      finally{try{await reader.cancel()}catch{}reader.releaseLock();}
    }catch(error){if(signal?.aborted)throw new SyncError('Operação interrompida.','cancelled');if(error instanceof SyncError)throw error;throw new SyncError('Sem conexão com o projeto. Seus dados locais continuam disponíveis.','network');}
    finally{clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',abort);}
  }
}
