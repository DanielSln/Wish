import {GatewayError} from '../search-gateway/contracts.ts';
import type {DurableStore} from './store.ts';
/** LAB ONLY: reject-by-default binding + operator capability are checked by the caller. */
export function operatorFixture(store:DurableStore,action:unknown){
  if(action==='expire-pairs')store.q('UPDATE a_device SET expires=0');
  else if(action==='expire-nonces')store.q('UPDATE a_nonce SET expires=0');
  else if(action==='cap-requests')store.q("WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<4095) INSERT OR IGNORE INTO c_request SELECT 'fixture-'||x,'fixture-key','tombstone',NULL FROM n");
  else if(action==='expire-sessions')store.q('UPDATE a_session SET expires=0');
  else if(action==='age-results')store.q("UPDATE c_request SET data=json_set(data,'$.queriedAt',?) WHERE state='done'",new Date(Date.now()-900001).toISOString());
  else if(action==='fault')store.fault='sync';
  else throw new GatewayError('INVALID_REQUEST');
  return {ok:true};
}
