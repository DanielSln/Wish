import { BackendHttp } from './http.ts';
import type { SessionStorage } from './secret-store.ts';
import { isUuid, SyncError } from '../sync/types.ts';
export type AuthSession = { access_token:string;refresh_token:string;expires_at:number;user:{id:string;email:string} };
export type AuthState = { ready:boolean;session:AuthSession|null;needsReauth:boolean;error:string;logoutFailed:boolean };
function parseSession(value:unknown, now:number):AuthSession {
  const v=value as Partial<AuthSession>&{expires_in?:number};
  const expires=v?.expires_at??(typeof v?.expires_in==='number'?Math.floor(now/1000)+v.expires_in:0);
  if(!v||!isUuid(v.user?.id)||typeof v.user?.email!=='string'||v.user.email.length>320||typeof v.access_token!=='string'||v.access_token.length<20||v.access_token.length>20000||typeof v.refresh_token!=='string'||v.refresh_token.length<8||v.refresh_token.length>20000||!Number.isSafeInteger(expires)||expires<=0)throw new SyncError('A sessão retornada pelo projeto é inválida.','invalid');
  return {access_token:v.access_token,refresh_token:v.refresh_token,expires_at:expires,user:{id:v.user.id,email:v.user.email}};
}
export class AuthService {
  private current:AuthState={ready:false,session:null,needsReauth:false,error:'',logoutFailed:false};
  private verifying=false;private epoch=0;private refreshing:Promise<AuthSession>|null=null;private listeners=new Set<()=>void>();private pendingLogout:AuthSession|null=null;
  constructor(readonly http:BackendHttp, readonly storage:SessionStorage, readonly clock=()=>Date.now()){}
  get snapshot(){return this.current;}
  get identity(){return this.current.session?.user.id??null;}
  subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
  private update(next:Partial<AuthState>){this.current={...this.current,...next};for(const l of this.listeners)l();}
  async restore(){const epoch=this.epoch;try{const raw=await this.storage.get();if(epoch!==this.epoch)return;this.update({session:raw?parseSession(JSON.parse(raw),this.clock()):null,ready:true});}catch{if(epoch===this.epoch)this.update({session:null,ready:true,error:'Não foi possível ler a sessão protegida. O catálogo local foi preservado; entre novamente.'});}}
  async sendCode(email:string){
    if(this.current.logoutFailed)throw new SyncError('Conclua a saída da conta anterior antes de entrar.','auth');
    const clean=email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)||clean.length>254)throw new SyncError('Informe um e-mail válido.','invalid');
    if(this.identity&&this.current.session!.user.email.toLowerCase()!==clean)throw new SyncError('Saia da conta atual antes de usar outro e-mail.','permission');
    await this.http.call('/auth/v1/otp',{email:clean,create_user:true});
  }
  async verifyCode(email:string,code:string){
    if(this.verifying)throw new SyncError('Aguarde a verificação em andamento.','invalid');
    this.verifying=true;try{
    if(this.current.logoutFailed)throw new SyncError('Conclua a saída anterior.','auth');
    if(!/^\d{6,8}$/.test(code.trim()))throw new SyncError('Informe o código numérico recebido por e-mail.','invalid');
    if(this.identity&&this.current.session!.user.email.toLowerCase()!==email.trim().toLowerCase())throw new SyncError('Saia antes de trocar de conta.','permission');
    const epoch=this.epoch;const data=await this.http.call('/auth/v1/verify',{email:email.trim().toLowerCase(),token:code.trim(),type:'email'});
    const session=parseSession(data,this.clock());if(session.user.email.toLowerCase()!==email.trim().toLowerCase()||(this.identity&&this.identity!==session.user.id))throw new SyncError('A conta retornada não corresponde à entrada solicitada. Saia antes de trocar de conta.','permission');if(epoch!==this.epoch)throw new SyncError('Entrada interrompida.','cancelled');
    try{await this.storage.set(JSON.stringify(session));}catch{throw new SyncError('Não foi possível proteger a sessão neste dispositivo. Tente novamente.','auth');}
    if(epoch!==this.epoch)throw new SyncError('Entrada interrompida.','cancelled');
    this.update({ready:true,session,needsReauth:false,error:''});
    }finally{this.verifying=false;}
  }
  requireReauth(owner:string){if(this.identity===owner)this.update({needsReauth:true,error:'Entre novamente para retomar o backup. Seus dados locais foram preservados.'});}
  async tokenFor(owner:string, force=false):Promise<string>{
    const session=this.current.session;if(!session||session.user.id!==owner||this.current.logoutFailed)throw new SyncError('Entre na conta correta para sincronizar.','auth');
    if(this.current.needsReauth)throw new SyncError('A sessão expirou. Entre novamente.','auth');
    if(force||session.expires_at*1000<=this.clock()+60000){const renewed=await this.refresh();if(this.identity!==owner)throw new SyncError('Conta alterada.','cancelled');return renewed.access_token;}
    return session.access_token;
  }
  private refresh():Promise<AuthSession>{
    if(this.refreshing)return this.refreshing;
    const epoch=this.epoch;const previous=this.current.session;if(!previous)return Promise.reject(new SyncError('Sessão ausente.','auth'));
    const run=(async()=>{
      try{
        const data=await this.http.call('/auth/v1/token?grant_type=refresh_token',{refresh_token:previous.refresh_token});const session=parseSession(data,this.clock());
        if(epoch!==this.epoch)throw new SyncError('Renovação interrompida.','cancelled');
        if(session.user.id!==previous.user.id)throw new SyncError('A renovação retornou outra conta.','permission');
        await this.storage.set(JSON.stringify(session));if(epoch!==this.epoch)throw new SyncError('Renovação interrompida.','cancelled');
        this.update({session,needsReauth:false,error:''});return session;
      }catch(error){if(epoch===this.epoch&&error instanceof SyncError&&error.code!=='network'&&error.code!=='cancelled')this.update({needsReauth:true,error:'Entre novamente para retomar o backup. Seus dados locais foram preservados.'});throw error;}
    })();this.refreshing=run;run.finally(()=>{if(this.refreshing===run)this.refreshing=null}).catch(()=>{});return run;
  }
  async signOut():Promise<boolean>{
    const old=this.current.session??this.pendingLogout;this.epoch++;this.pendingLogout=old;
    this.update({session:null,needsReauth:false,error:'',logoutFailed:true});
    try{await this.storage.clear()}catch{this.update({error:'Não foi possível apagar a sessão protegida. A saída não foi concluída; desbloqueie o aparelho e tente novamente.',logoutFailed:true});return false;}
    this.pendingLogout=null;this.update({logoutFailed:false});
    if(old){
      try{await this.http.call('/auth/v1/logout?scope=local',undefined,old.access_token);}
      catch{this.update({error:'Sessão removida deste dispositivo. Não foi possível confirmar a revogação remota; sem conexão, ela depende do servidor/expiração.'});}
    }
    return true;
  }
}
