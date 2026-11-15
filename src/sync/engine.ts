import { SyncLocal } from './local.ts';
import { state } from './journal.ts';
import { count, remoteRecord, SyncError, type Remote } from './types.ts';
export class SyncEngine {
  private running:Promise<void>|null=null;
  private controller:AbortController|null=null;
  constructor(readonly local:SyncLocal, readonly remote:Remote, readonly owner:string, readonly backend:string, readonly authorized:()=>boolean, readonly clock=()=>Date.now(), readonly random=()=>Math.random()) {}
  get busy(){return this.running!==null;}
  stop(){this.controller?.abort();}
  run(manual=false):Promise<void>{
    if(this.running)return this.running;
    const controller=new AbortController();this.controller=controller;
    const check=()=>{if(controller.signal.aborted||!this.authorized())throw new SyncError('Sincronização interrompida.','cancelled');};
    const task=this.perform(check,controller.signal,manual).finally(()=>{if(this.controller===controller)this.controller=null;this.running=null;});
    this.running=task;return task;
  }
  private async pull(check:()=>void,signal:AbortSignal){
    for(let pages=0;pages<1000;pages++){
      check();const current=await this.local.store.read(async db=>{await this.local.assertOwner(db,this.owner,this.backend);return (await state(db))!});
      const page=await this.remote.pull(current.cursor,current.upper_cursor,signal);check();
      if(!count(page.cursor)||!count(page.upper)||page.cursor<current.cursor||page.upper<page.cursor||typeof page.more!=='boolean'||page.more!==(page.cursor<page.upper)||!Array.isArray(page.items)||page.items.length>100||(current.upper_cursor!==null&&page.upper!==current.upper_cursor))throw new SyncError('Página de recuperação inválida.','invalid');
      let previous=current.cursor;
      const items=page.items.map(value=>{const item=remoteRecord(value);if(item.seq<=previous||item.seq>page.upper)throw new SyncError('Ordem de recuperação inválida.','invalid');previous=item.seq;return item});
      if(page.cursor!==previous||(page.more&&!items.length))throw new SyncError('Cursor remoto inconsistente.','invalid');
      await this.local.store.write(async db=>{
        check();await this.local.assertOwner(db,this.owner,this.backend);
        for(const record of items)await db.runAsync('INSERT OR IGNORE INTO sync_inbox(seq,payload) VALUES (?,?)',record.seq,JSON.stringify(record));
        await this.local.drainInbox(db);
        await db.runAsync('UPDATE sync_state SET cursor=?,upper_cursor=?,initial_complete=? WHERE id=1',page.cursor,page.more?page.upper:null,page.more?current.initial_complete:1);
        check();
      });
      if(!page.more)return;
    }
    throw new SyncError('A recuperação continuará em uma nova tentativa.','network');
  }
  private async perform(check:()=>void,signal:AbortSignal,manual:boolean){
    try{
      check();const before=await this.local.summary();
      if(!before.state.owner_id||!before.state.enabled)return;
      if(!manual&&before.state.retry_at>this.clock())return;
      if(!manual&&before.state.last_error){const failure=JSON.parse(before.state.last_error) as {code:string};if(failure.code!=='network')return;}
      await this.pull(check,signal);
      for(let sent=0;sent<200;sent++){
        check();const next=await this.local.next(this.owner,this.backend,check);if(!next)break;
        const response=await this.remote.push(next.operation,signal);check();
        const record=remoteRecord(response.record);
        if(!['ok','conflict','category_name','category_in_use'].includes(response.status))throw new SyncError('Confirmação remota inválida.','invalid');
        await this.local.store.write(async db=>{
          check();await this.local.assertOwner(db,this.owner,this.backend);
          if(response.status==='ok')await this.local.ack(db,next.row,record);
          else if(response.status==='category_name')await this.local.conflict(db,record,'category_name',next.row.entity_id);
          else await this.local.conflict(db,record,response.status==='category_in_use'?'category_in_use':'version');
          check();
        });
      }
      await this.pull(check,signal);check();
      await this.local.store.write(async db=>{
        check();await this.local.assertOwner(db,this.owner,this.backend);
        const pending=await db.getFirstAsync<{n:number}>('SELECT (SELECT count(*) FROM sync_outbox)+(SELECT count(*) FROM sync_inbox)+(SELECT count(*) FROM sync_conflicts WHERE resolved_at IS NULL) AS n');
        await db.runAsync('UPDATE sync_state SET last_success=CASE WHEN ?=0 THEN ? ELSE last_success END,retry_count=0,retry_at=0,last_error=NULL WHERE id=1',pending!.n,new Date(this.clock()).toISOString());
        check();
      });
    }catch(error){
      if(!this.authorized()||signal.aborted||(error instanceof SyncError&&error.code==='cancelled'))return;
      const failure=error instanceof SyncError?error:new SyncError('Não foi possível sincronizar. Seus dados e alterações foram preservados.','network');
      await this.local.store.write(async db=>{
        check();const current=(await state(db))!;const attempts=current.retry_count+1;
        const backoff=Math.max(failure.retryAfterMs,Math.min(300000,2000*2**Math.min(attempts-1,8))*(0.85+this.random()*0.3));
        await db.runAsync('UPDATE sync_state SET retry_count=?,retry_at=?,last_error=? WHERE id=1',attempts,failure.code==='network'?this.clock()+Math.round(backoff):0,JSON.stringify({code:failure.code,message:failure.message}));
      });
    }
  }
}
