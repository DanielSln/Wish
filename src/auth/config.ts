export type BackendConfig = { url:string; key:string };
export function backendConfig(url:string|undefined,key:string|undefined):BackendConfig|null {
  if(!url?.trim()||!key?.trim())return null;
  const parsed=new URL(url.trim());const publicKey=key.trim();
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||parsed.port)throw new Error('A URL pública do Supabase deve ser uma origem HTTPS.');
  if(publicKey.startsWith('sb_secret_'))throw new Error('Chaves secretas não podem ser usadas no aplicativo.');
  if(!publicKey.startsWith('sb_publishable_')){
    try{
      const part=publicKey.split('.')[1];const payload=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
      if(payload.role!=='anon')throw new Error('role');
    }catch{throw new Error('Use somente a publishable key ou anon key pública do Supabase.');}
  }
  return {url:parsed.origin,key:publicKey};
}
