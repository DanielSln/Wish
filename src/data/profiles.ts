import type { Database } from './migrations.ts';
import { localStore } from './store.ts';
import { isUuid, SyncError } from '../sync/types.ts';
export type CatalogIdentity = { userId:string;backend:string };
export const accountScope = (identity:CatalogIdentity) => identity.backend+'#'+identity.userId;
export class CatalogProfiles {
  constructor(readonly db:Database, readonly inspect:(file:string)=>Promise<{owner_id:string|null;backend:string|null}>, readonly uuid:()=>string){}
  async init(){await this.db.execAsync("CREATE TABLE IF NOT EXISTS device_settings(key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS catalog_profiles(scope TEXT PRIMARY KEY NOT NULL,file TEXT NOT NULL UNIQUE); INSERT OR IGNORE INTO device_settings(key,value) VALUES ('guest_file','wish.db');");}
  async select(identity:CatalogIdentity|null):Promise<string>{
    return localStore(this.db).write(async db=>{
      if(identity){
        const known=await db.getFirstAsync<{file:string}>('SELECT file FROM catalog_profiles WHERE scope=?',accountScope(identity));
        if(known){const owner=await this.inspect(known.file);if(owner.owner_id!==identity.userId||owner.backend!==identity.backend)throw new SyncError('O catálogo desta conta precisa de recuperação. Nenhum dado foi apagado.','permission');return known.file;}
      }
      const guest=(await db.getFirstAsync<{value:string}>("SELECT value FROM device_settings WHERE key='guest_file'"))!.value;
      const info=await this.inspect(guest);
      if(!info.owner_id)return guest;
      // Recover the crash window between catalog binding and registry commit before rendering data.
      if(!info.backend||!isUuid(info.owner_id))throw new SyncError('Vínculo local inválido.','permission');
      const scope=accountScope({userId:info.owner_id,backend:info.backend});
      const previous=await db.getFirstAsync<{file:string}>('SELECT file FROM catalog_profiles WHERE scope=?',scope);
      if(previous&&previous.file!==guest)throw new SyncError('Há dois catálogos preservados para esta conta. É necessária recuperação explícita.','permission');
      await db.runAsync('INSERT OR IGNORE INTO catalog_profiles(scope,file) VALUES (?,?)',scope,guest);
      const fresh=`wish-local-${this.uuid()}.db`;await db.runAsync("UPDATE device_settings SET value=? WHERE key='guest_file'",fresh);
      return identity&&accountScope(identity)===scope?guest:fresh;
    });
  }
  async register(identity:CatalogIdentity,file:string){
    const owner=await this.inspect(file);
    if(owner.owner_id!==identity.userId||owner.backend!==identity.backend)throw new SyncError('O vínculo da conta não corresponde ao catálogo.','permission');
    await localStore(this.db).write(async db=>{
      const scope=accountScope(identity);const existing=await db.getFirstAsync<{file:string}>('SELECT file FROM catalog_profiles WHERE scope=?',scope);
      if(existing&&existing.file!==file)throw new SyncError('Esta conta já tem outro catálogo local preservado.','permission');
      await db.runAsync('INSERT OR IGNORE INTO catalog_profiles(scope,file) VALUES (?,?)',scope,file);
      const guest=(await db.getFirstAsync<{value:string}>("SELECT value FROM device_settings WHERE key='guest_file'"))!.value;
      if(guest===file)await db.runAsync("UPDATE device_settings SET value=? WHERE key='guest_file'",`wish-local-${this.uuid()}.db`);
    });
  }
}
