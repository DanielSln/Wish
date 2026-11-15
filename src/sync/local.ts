import type { Database } from '../data/migrations.ts';
import type { LocalStore } from '../data/store.ts';
import { archive, enqueue, snapshot, state, tableFor, type SyncState } from './journal.ts';
import { isUuid, remoteRecord, sameContent, SyncError, type CategoryData, type Kind, type ProductData, type PushOperation, type RecordData, type RemoteRecord } from './types.ts';
export type OutboxRow = { seq:number; op_id:string; kind:Kind; entity_id:string; payload:string; local_revision:number; base_version:number|null; attempted:number };
export type Conflict = { id:string;kind:Kind;entity_id:string;related_id:string|null;local_payload:string|null;remote_payload:string;type:string;created_at:string;resolved_at:string|null };
export type Summary = { state:SyncState; pending:number; conflicts:number; inbox:number; localProducts:number; localCategories:number };
export class SyncLocal {
  constructor(readonly store:LocalStore, readonly uuid:()=>string, readonly now=()=>new Date().toISOString()) {}
  async summary():Promise<Summary> {
    return this.store.read(async db => ({ state:(await state(db))!, pending:(await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM sync_outbox'))!.n, conflicts:(await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM sync_conflicts WHERE resolved_at IS NULL'))!.n, inbox:(await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM sync_inbox'))!.n, localProducts:(await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM products WHERE deleted_at IS NULL'))!.n, localCategories:(await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM categories WHERE deleted_at IS NULL'))!.n }));
  }
  async assertOwner(db:Database, owner:string, backend:string) {
    const current=await state(db);
    if(!current?.enabled||current.owner_id!==owner||current.backend!==backend) throw new SyncError('Este catálogo pertence a outra conta ou o backup não foi confirmado.','permission');
  }
  async activate(owner:string, backend:string) {
    if(!isUuid(owner)||!backend.startsWith('https://'))throw new SyncError('Conta ou projeto inválido.','invalid');
    await this.store.write(async db=>{
      const current=(await state(db))!;
      if(current.owner_id&&(current.owner_id!==owner||current.backend!==backend)) throw new SyncError('Não é permitido associar o catálogo de outra conta.','permission');
      if(current.enabled)return;
      await db.runAsync('UPDATE sync_state SET owner_id=?,backend=?,enabled=1,last_error=NULL,retry_at=0 WHERE id=1',owner,backend);
      for(const kind of ['category','product'] as const){
        const rows=await db.getAllAsync<RecordData>(`SELECT * FROM ${tableFor(kind)}`);
        for(const row of rows){await archive(db,kind,row,'before-first-backup',this.now(),this.uuid);await enqueue(db,kind,row.id,this.uuid);}
      }
    },'catalog');
  }
  async put(db:Database, record:RemoteRecord) {
    const data=record.data;
    const fields=record.kind==='category'?['id','name','created_at','updated_at','deleted_at']:['id','name','description','category_id','priority','image_url','price_cents','desired_price_cents','store','original_url','notes','status','created_at','updated_at','deleted_at'];
    const row=data as unknown as Record<string,string|number|null>;
    await db.runAsync(`INSERT INTO ${tableFor(record.kind)}(${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${fields.slice(1).map(k=>`${k}=excluded.${k}`).join(',')}`,...fields.map(k=>row[k]));
    await this.version(db,record);
  }
  async version(db:Database, record:RemoteRecord) {
    await db.runAsync('INSERT INTO sync_versions(kind,entity_id,server_version,local_revision) VALUES (?,?,?,0) ON CONFLICT(kind,entity_id) DO UPDATE SET server_version=MAX(server_version,excluded.server_version)',record.kind,record.id,record.version);
  }
  async conflict(db:Database, record:RemoteRecord, type='version', relatedId:string|null=null) {
    const local=await snapshot(db,record.kind,relatedId??record.id);
    if(local)await archive(db,record.kind,local,'before-conflict',this.now(),this.uuid);
    const existing=await db.getFirstAsync<{id:string}>('SELECT id FROM sync_conflicts WHERE kind=? AND entity_id=? AND resolved_at IS NULL',record.kind,record.id);
    if(existing)await db.runAsync('UPDATE sync_conflicts SET remote_payload=?,local_payload=?,type=?,related_id=? WHERE id=?',JSON.stringify(record),local?JSON.stringify(local):null,type,relatedId,existing.id);
    else await db.runAsync('INSERT INTO sync_conflicts(id,kind,entity_id,related_id,local_payload,remote_payload,type,created_at) VALUES (?,?,?,?,?,?,?,?)',this.uuid(),record.kind,record.id,relatedId,local?JSON.stringify(local):null,JSON.stringify(record),type,this.now());
  }
  async apply(db:Database, record:RemoteRecord):Promise<boolean> {
    const known=await db.getFirstAsync<{server_version:number}>('SELECT server_version FROM sync_versions WHERE kind=? AND entity_id=?',record.kind,record.id);
    if(known&&known.server_version>=record.version)return true;
    const own=record.op_id?await db.getFirstAsync<OutboxRow>('SELECT * FROM sync_outbox WHERE op_id=?',record.op_id):null;
    if(own){await this.ack(db,own,record);return true;}
    const local=await snapshot(db,record.kind,record.id);
    const dirty=await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM sync_outbox WHERE kind=? AND entity_id=?',record.kind,record.id);
    if(local&&dirty!.n){
      if(sameContent(local,record.data)){
        await archive(db,record.kind,local,'equivalent-remote-confirmed',this.now(),this.uuid);
        await db.runAsync('DELETE FROM sync_outbox WHERE kind=? AND entity_id=?',record.kind,record.id);
        await this.version(db,record);
        return true;
      }
      await this.conflict(db,record);return true;
    }
    if(record.kind==='category'){
      const rows=await db.getAllAsync<CategoryData>('SELECT * FROM categories');
      const collision=rows.find(c=>c.id!==record.id&&c.name.toLocaleLowerCase('pt-BR')===record.data.name.toLocaleLowerCase('pt-BR'));
      if(collision){await this.conflict(db,record,'category_name',collision.id);return true;}
      if(record.data.deleted_at){
        const active=await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM products WHERE category_id=? AND deleted_at IS NULL',record.id);
        if(active!.n){await this.conflict(db,record,'category_in_use');return true;}
      }
    }else{
      const p=record.data as ProductData;
      const category=await db.getFirstAsync<CategoryData>('SELECT * FROM categories WHERE id=?',p.category_id);
      if(!category||(!p.deleted_at&&category.deleted_at))return false;
    }
    if(local&&!sameContent(local,record.data))await archive(db,record.kind,local,'before-remote-apply',this.now(),this.uuid);
    await this.put(db,record);return true;
  }
  async drainInbox(db:Database) {
    const rows=await db.getAllAsync<{seq:number;payload:string}>('SELECT seq,payload FROM sync_inbox ORDER BY seq');
    for(const row of rows){const record=remoteRecord(JSON.parse(row.payload));if(await this.apply(db,record))await db.runAsync('DELETE FROM sync_inbox WHERE seq=?',row.seq);}
  }
  async ack(db:Database, operation:OutboxRow, record:RemoteRecord) {
    if(record.kind!==operation.kind||record.id!==operation.entity_id)throw new SyncError('Confirmação do servidor não corresponde à alteração.','invalid');
    if(!sameContent(JSON.parse(operation.payload),record.data))throw new SyncError('O servidor confirmou um conteúdo diferente da alteração enviada.','invalid');
    await db.runAsync('DELETE FROM sync_outbox WHERE op_id=?',operation.op_id);
    const known=await db.getFirstAsync<{server_version:number}>('SELECT server_version FROM sync_versions WHERE kind=? AND entity_id=?',record.kind,record.id);
    await this.version(db,record);
    if(known&&known.server_version>record.version)return;
    const pending=await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM sync_outbox WHERE kind=? AND entity_id=?',record.kind,record.id);
    const current=await snapshot(db,record.kind,record.id);
    // An acknowledgement never overwrites a newer UI edit.
    if(!pending!.n&&current&&sameContent(current,JSON.parse(operation.payload))){
      if(record.kind==='category'&&record.data.deleted_at){
        const used=await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM products WHERE category_id=? AND deleted_at IS NULL',record.id);
        if(used!.n)return;
      }
      await this.put(db,record);
    }
  }
  async next(owner:string,backend:string,check:()=>void):Promise<{row:OutboxRow;operation:PushOperation}|null> {
    return this.store.write(async db=>{
      check();await this.assertOwner(db,owner,backend);
      const rows=await db.getAllAsync<OutboxRow>(`SELECT q.* FROM sync_outbox q WHERE NOT EXISTS (SELECT 1 FROM sync_outbox older WHERE older.kind=q.kind AND older.entity_id=q.entity_id AND older.seq<q.seq) AND NOT EXISTS (SELECT 1 FROM sync_conflicts c WHERE c.resolved_at IS NULL AND c.kind=q.kind AND (c.entity_id=q.entity_id OR c.related_id=q.entity_id)) ORDER BY q.priority,q.seq LIMIT 100`);
      for(const row of rows){
        const data=JSON.parse(row.payload) as RecordData;
        if(row.kind==='product'){
          const dependency=await db.getFirstAsync<{n:number}>("SELECT count(*) AS n FROM sync_conflicts WHERE kind='category' AND resolved_at IS NULL AND (entity_id=? OR related_id=?)",(data as ProductData).category_id,(data as ProductData).category_id);
          const parentPending=await db.getFirstAsync<{n:number}>("SELECT count(*) AS n FROM sync_outbox WHERE kind='category' AND entity_id=? AND priority<10",(data as ProductData).category_id);
          if(dependency!.n||parentPending!.n)continue;
        }
        if(!row.attempted){
          const v=await db.getFirstAsync<{server_version:number}>('SELECT server_version FROM sync_versions WHERE kind=? AND entity_id=?',row.kind,row.entity_id);
          row.base_version=v?.server_version??0;
          await db.runAsync('UPDATE sync_outbox SET attempted=1,base_version=? WHERE op_id=?',row.base_version,row.op_id);
        }
        check();return {row,operation:{op_id:row.op_id,kind:row.kind,id:row.entity_id,base_version:row.base_version!,data}};
      }
      return null;
    });
  }
  conflicts() { return this.store.read(db=>db.getAllAsync<Conflict>('SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY created_at')); }
  archives() { return this.store.read(db=>db.getAllAsync<{id:string;kind:Kind;payload:string;reason:string;created_at:string}>('SELECT id,kind,payload,reason,created_at FROM sync_archive ORDER BY created_at DESC LIMIT 30')); }
  async resolve(id:string, choice:'local'|'remote'|'merge_category'|'keep_both', newName='') {
    await this.store.write(async db=>{
      const conflict=await db.getFirstAsync<Conflict>('SELECT * FROM sync_conflicts WHERE id=? AND resolved_at IS NULL',id);
      if(!conflict)throw new SyncError('Este conflito já foi resolvido.','invalid');
      const remote=remoteRecord(JSON.parse(conflict.remote_payload));
      const local=await snapshot(db,remote.kind,conflict.related_id??remote.id);
      if(local)await archive(db,remote.kind,local,'before-explicit-resolution',this.now(),this.uuid);
      if(conflict.type==='category_name'){
        if(remote.kind!=='category'||!local)throw new SyncError('Conflito de categoria inválido.','invalid');
        if(choice==='keep_both'){
          const name=newName.trim();
          const rows=await db.getAllAsync<CategoryData>('SELECT * FROM categories');
          if(!name||name.length>60||rows.some(c=>c.id!==remote.id&&c.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))throw new SyncError('Escolha um nome diferente com até 60 caracteres para a categoria recebida.','invalid');
          await this.put(db,{...remote,data:{...remote.data,name}});
          await db.runAsync("DELETE FROM sync_outbox WHERE kind='category' AND entity_id=?",remote.id);
          await enqueue(db,'category',remote.id,this.uuid,-10);
        }else if(choice==='merge_category'){
          if(remote.data.deleted_at){const active=await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM products WHERE category_id=? AND deleted_at IS NULL',local.id);if(active!.n)throw new SyncError('A categoria recebida foi excluída. Guarde ambas ou mova os produtos antes de unificar.','invalid');}
          const archivedName=`${local.name.slice(0,35)} [arquivo ${this.uuid().slice(0,8)}]`;
          await db.runAsync('UPDATE categories SET name=?,deleted_at=?,updated_at=? WHERE id=?',archivedName,this.now(),this.now(),local.id);
          await this.put(db,remote);
          const products=await db.getAllAsync<ProductData>('SELECT * FROM products WHERE category_id=?',local.id);
          for(const p of products){await archive(db,'product',p,'before-category-merge',this.now(),this.uuid);await db.runAsync('UPDATE products SET category_id=?,updated_at=? WHERE id=?',remote.id,this.now(),p.id);await db.runAsync("DELETE FROM sync_outbox WHERE kind='product' AND entity_id=?",p.id);await enqueue(db,'product',p.id,this.uuid);}
          await db.runAsync("DELETE FROM sync_outbox WHERE kind='category' AND entity_id=?",local.id);
          await enqueue(db,'category',local.id,this.uuid,10);
        }else throw new SyncError('Escolha unir as categorias ou guardar ambas com nomes diferentes.','invalid');
      }else if(choice==='local'){
        if(!local)throw new SyncError('Não existe uma cópia local para manter.','invalid');
        await this.version(db,remote);
        await db.runAsync('DELETE FROM sync_outbox WHERE kind=? AND entity_id=?',remote.kind,remote.id);
        await enqueue(db,remote.kind,remote.id,this.uuid,remote.kind==='category'&&!local.deleted_at?-10:0);
      }else if(choice==='remote'){
        if(remote.kind==='product'&&!remote.data.deleted_at){const category=await db.getFirstAsync<CategoryData>('SELECT * FROM categories WHERE id=? AND deleted_at IS NULL',(remote.data as ProductData).category_id);if(!category)throw new SyncError('Resolva primeiro a categoria da versão recebida.','invalid');}
        if(remote.kind==='category'&&remote.data.deleted_at){
          const used=await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM products WHERE category_id=? AND deleted_at IS NULL',remote.id);
          if(used!.n)throw new SyncError('Mova os produtos locais antes de aceitar a exclusão desta categoria.','invalid');
        }
        await db.runAsync('DELETE FROM sync_outbox WHERE kind=? AND entity_id=?',remote.kind,remote.id);
        await this.put(db,remote);
      }else throw new SyncError('Resolução inválida.','invalid');
      await db.runAsync('UPDATE sync_conflicts SET resolved_at=? WHERE id=?',this.now(),id);
      await db.runAsync('UPDATE sync_state SET last_error=NULL,retry_at=0 WHERE id=1');
      await this.drainInbox(db);
    },'catalog');
  }
}
