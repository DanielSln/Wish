export interface SecretBackend { get(key:string):Promise<string|null>; set(key:string,value:string):Promise<void>; remove(key:string):Promise<void>; }
export interface SessionStorage { get():Promise<string|null>; set(value:string):Promise<void>; clear():Promise<void>; }
// Chunks remain in the secure backend, never in the catalog. The manifest is the commit point.
// A failed write preserves the previous complete generation. Logout commits a null pointer first.
export function chunkedSecretStore(backend:SecretBackend, namespace:string, nonce:()=>string):SessionStorage {
  let tail:Promise<unknown>=Promise.resolve();
  function locked<T>(task:()=>Promise<T>){const next=tail.then(task);tail=next.catch(()=>{});return next;}
  const manifestKey=namespace+'.manifest';
  async function manifest(){
    const value=await backend.get(manifestKey);if(!value||value==='null')return null;
    const m=JSON.parse(value) as {generation:string;parts:number};
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(m.generation)||!Number.isSafeInteger(m.parts)||m.parts<1||m.parts>200)throw new Error('Sessão protegida inválida.');
    return m;
  }
  async function clean(m:{generation:string;parts:number}|null){if(m)for(let i=0;i<m.parts;i++){try{await backend.remove(`${namespace}.${m.generation}.${i}`)}catch{/* Unreachable encrypted chunks do not restore a session. */}}}
  return {
    get:()=>locked(async()=>{const m=await manifest();if(!m)return null;let value='';for(let i=0;i<m.parts;i++){const part=await backend.get(`${namespace}.${m.generation}.${i}`);if(part===null)throw new Error('Sessão protegida incompleta.');value+=part;}return value;}),
    set:value=>locked(async()=>{
      if(value.length>64000)throw new Error('Sessão excede o limite seguro.');
      let previous:null|{generation:string;parts:number}=null;try{previous=await manifest()}catch{}const generation=nonce();const characters=Array.from(value);const parts=Math.max(1,Math.ceil(characters.length/400));
      try{for(let i=0;i<parts;i++)await backend.set(`${namespace}.${generation}.${i}`,characters.slice(i*400,(i+1)*400).join(''));await backend.set(manifestKey,JSON.stringify({generation,parts}));}
      catch(error){await clean({generation,parts});throw error;}
      await clean(previous);
    }),
    clear:()=>locked(async()=>{let old:null|{generation:string;parts:number}=null;try{old=await manifest()}catch{}await backend.set(manifestKey,'null');await clean(old);}),
  };
}
