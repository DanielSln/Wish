import { AuthService } from '../auth/service.ts';
import { BackendHttp } from '../auth/http.ts';
import { SyncError, type PullPage, type PushOperation, type PushResult, type Remote } from './types.ts';
export function supabaseRemote(http:BackendHttp,auth:AuthService,owner:string):Remote {
  async function call(path:string,body:unknown,signal:AbortSignal){
    const token=await auth.tokenFor(owner);if(auth.identity!==owner||signal.aborted)throw new SyncError('Conta alterada.','cancelled');
    try{const value=await http.call(path,body,token,signal);if(auth.identity!==owner)throw new SyncError('Conta alterada.','cancelled');return value;}
    catch(error){
      if(!(error instanceof SyncError)||error.code!=='auth')throw error;
      const refreshed=await auth.tokenFor(owner,true);if(auth.identity!==owner||signal.aborted)throw new SyncError('Conta alterada.','cancelled');
      try{const value=await http.call(path,body,refreshed,signal);if(auth.identity!==owner)throw new SyncError('Conta alterada.','cancelled');return value;}catch(retryError){if(retryError instanceof SyncError&&retryError.code==='auth')auth.requireReauth(owner);throw retryError;}
    }
  }
  return {
    push:async(operation:PushOperation,signal)=>await call('/rest/v1/rpc/wish_sync_push',{p_op_id:operation.op_id,p_kind:operation.kind,p_id:operation.id,p_base_version:operation.base_version,p_payload:operation.data},signal) as PushResult,
    pull:async(cursor,upper,signal)=>await call('/rest/v1/rpc/wish_sync_pull',{p_cursor:cursor,p_upper:upper,p_limit:100},signal) as PullPage,
  };
}
