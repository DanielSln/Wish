import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/data/migrations.ts';
import { createRepository } from '../../src/data/repository.ts';
import { localStore } from '../../src/data/store.ts';
import { SyncLocal } from '../../src/sync/local.ts';
import { SyncEngine } from '../../src/sync/engine.ts';
import { SyncError, validateRecord } from '../../src/sync/types.ts';
export const ownerA='11111111-1111-4111-8111-111111111111';
export const ownerB='22222222-2222-4222-8222-222222222222';
export const backend='https://wish-test.example';
export function adapter(raw){return {
 async execAsync(sql){raw.exec(sql)},async runAsync(sql,...args){return raw.prepare(sql).run(...args)},async getFirstAsync(sql,...args){return raw.prepare(sql).get(...args)??null},async getAllAsync(sql,...args){return raw.prepare(sql).all(...args)},
 async withTransactionAsync(task){raw.exec('BEGIN');try{await task();raw.exec('COMMIT')}catch(e){raw.exec('ROLLBACK');throw e}},
};}
export async function device(path=':memory:'){
 const raw=new DatabaseSync(path);const db=adapter(raw);await migrate(db);const repo=createRepository(db,randomUUID);const local=new SyncLocal(localStore(db),randomUUID);
 return {raw,db,repo,local,engine:(remote,owner=ownerA,authorized=()=>true,clock=()=>Date.now())=>new SyncEngine(local,remote,owner,backend,authorized,clock,()=>0.5)};
}
export const productInput=category_id=>({name:'Desejo de teste',description:'',category_id,priority:'medium',image_url:'',price_cents:null,desired_price_cents:null,store:'',original_url:'',notes:'',status:'pending'});
export class MemoryServer {
 accounts=new Map();failBefore=0;loseAck=0;pushCalls=0;pullCalls=0;pageSize=100;gate=null;
 account(owner){if(!this.accounts.has(owner))this.accounts.set(owner,{records:new Map(),receipts:new Map(),changes:[]});return this.accounts.get(owner)}
 remote(owner){return {
  push:async(op,signal)=>{this.pushCalls++;if(signal.aborted)throw new SyncError('cancelled','cancelled');if(this.failBefore-- >0)throw new SyncError('rede','network');if(this.gate)await this.gate(op);const result=this.commit(owner,op);if(this.loseAck-- >0)throw new SyncError('resposta perdida','network');return result},
  pull:async(cursor,upper,signal)=>{this.pullCalls++;if(signal.aborted)throw new SyncError('cancelled','cancelled');if(this.failBefore-- >0)throw new SyncError('rede','network');const a=this.account(owner);const top=upper??a.changes.length;const items=a.changes.filter(r=>r.seq>cursor&&r.seq<=top).slice(0,this.pageSize);const next=items.at(-1)?.seq??cursor;return structuredClone({items,cursor:next,upper:top,more:next<top})},
 }}
 commit(owner,op){
  const a=this.account(owner);const hash=JSON.stringify(op);const receipt=a.receipts.get(op.op_id);if(receipt){if(receipt.hash!==hash)throw new SyncError('op alterada','invalid');return structuredClone(receipt.response)}
  const data=validateRecord(op.kind,op.data);const key=op.kind+':'+op.id;const current=a.records.get(key);let response;
  if(current&&current.version!==op.base_version)response={status:'conflict',record:current};
  else if(!current&&op.base_version!==0)throw new SyncError('versão desconhecida','invalid');
  else {
   if(op.kind==='category'){
    const clash=[...a.records.values()].find(r=>r.kind==='category'&&r.id!==op.id&&!r.data.deleted_at&&r.data.name.toLowerCase()===data.name.toLowerCase());
    const used=[...a.records.values()].some(r=>r.kind==='product'&&!r.data.deleted_at&&r.data.category_id===op.id);
    if(data.deleted_at&&used)response={status:'category_in_use',record:current};
    else if(!data.deleted_at&&clash)response={status:'category_name',record:clash};
   }else{
    const category=a.records.get('category:'+data.category_id);
    if(!category||(!data.deleted_at&&category.data.deleted_at))throw new SyncError('categoria ausente','invalid');
   }
   if(!response){const record={kind:op.kind,id:op.id,version:(current?.version??0)+1,seq:a.changes.length+1,data:structuredClone(data),op_id:op.op_id};a.records.set(key,record);a.changes.push(record);response={status:'ok',record};}
  }
  a.receipts.set(op.op_id,{hash,response:structuredClone(response)});return structuredClone(response);
 }
}
