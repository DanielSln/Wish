export type ImageErrorCode = 'URL'|'NETWORK'|'TIMEOUT'|'CANCELLED'|'SERVER'|'REDIRECT'|'CONTENT'|'SIZE'|'FORMAT'|'STREAM'|'CACHE';
export class ImageLoadError extends Error {
  readonly code:ImageErrorCode;
  constructor(code:ImageErrorCode,message:string){super(message);this.code=code;this.name='ImageLoadError';}
}
export function imageErrorMessage(error:unknown,web=false):string {
  if(error instanceof ImageLoadError)return error.message+(web&&error.code==='NETWORK'?' No navegador, o servidor também pode bloquear consultas externas.':'');
  return 'Não foi possível preparar a imagem. Tente novamente ou escolha uma foto da galeria.';
}
function sameImageAddress(first:string,second:string){try{const a=new URL(first),b=new URL(second);a.hash='';b.hash='';return a.href===b.href;}catch{return false;}}
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const localImagePattern = /^wish-image:\/\/([a-f0-9]{64})\.(jpg|png|webp|gif)$/;
export const isLocalImage = (value: string) => localImagePattern.test(value);
export function remoteImageUrl(value: string): string {
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) throw new ImageLoadError('URL','Endereço inválido. Use um link HTTPS direto de até 2048 caracteres.');
  let url: URL; try { url = new URL(value); } catch { throw new ImageLoadError('URL','Endereço inválido. Cole o link HTTPS direto da imagem.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/,'');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host) || host === 'localhost.localdomain' || ['.local','.localhost','.internal','.lan','.home'].some(s=>host.endsWith(s))) throw new ImageLoadError('URL','Use um link HTTPS público direto para uma imagem, sem credenciais ou endereço local.');
  return value; // Preserve exact URL and parameters; never rewrite a store/CDN URL.
}
export function imageExtension(bytes: Uint8Array): string {
  if (!bytes.length) throw new Error('O servidor retornou um arquivo de imagem vazio.');
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('A imagem deve ter até 8 MB.');
  if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return checkedImage(bytes,'jpg');
  if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return checkedImage(bytes,'png');
  const text = (a:number,b:number)=>String.fromCharCode(...bytes.slice(a,b));
  if (text(0,4)==='RIFF' && text(8,12)==='WEBP') return checkedImage(bytes,'webp');
  if (['GIF87a','GIF89a'].includes(text(0,6))) return checkedImage(bytes,'gif');
  throw new Error('Escolha uma imagem JPEG, PNG, WebP ou GIF válida.');
}
export type ImagePreview = { uri: string; release: () => void };
export interface ImageStorage {
  readPicked(uri: string): Promise<Uint8Array>;
  persist(bytes: Uint8Array, extension: string): Promise<string>;
  resolve(reference: string): Promise<string | null>;
  temporary(bytes: Uint8Array, extension: string): Promise<ImagePreview>;
}
export async function remoteImageBytes(value: string, request: typeof fetch, signal?: AbortSignal) {
  const url=remoteImageUrl(value);const controller=new AbortController();let timedOut=false;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const timer=setTimeout(()=>{timedOut=true;abort();},12000);let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try{
    if(controller.signal.aborted)throw new ImageLoadError('CANCELLED','Consulta de imagem cancelada.');
    const response=await request(url,{signal:controller.signal,redirect:'manual',credentials:'omit',headers:{Accept:'image/jpeg,image/png,image/webp,image/gif'}});
    if(response.type==='opaqueredirect'||response.status>=300&&response.status<400||response.redirected||response.url&&!sameImageAddress(response.url,url)){
      await response.body?.cancel();throw new ImageLoadError('REDIRECT','Esse endereço redireciona. Use o link HTTPS final e direto da imagem.');
    }
    if(!response.ok){await response.body?.cancel();throw new ImageLoadError('SERVER',response.status===404?'Imagem não encontrada no servidor (HTTP 404).':`O servidor não disponibilizou a imagem (HTTP ${response.status}). Tente outro link.`);}
    if(!/^image\/(jpeg|png|webp|gif)(?:;|$)/i.test(response.headers.get('content-type')??'')){await response.body?.cancel();throw new ImageLoadError('CONTENT','O servidor não disponibilizou um arquivo JPEG, PNG, WebP ou GIF. Use o link da imagem, não o da página.');}
    if(Number(response.headers.get('content-length'))>MAX_IMAGE_BYTES){await response.body?.cancel();throw new ImageLoadError('SIZE','A imagem ultrapassa o limite de 8 MB.');}
    if(!response.body)throw new ImageLoadError('STREAM','Não foi possível conferir o tamanho da imagem neste cliente. Tente outra imagem.');
    reader=response.body.getReader();controller.signal.addEventListener('abort',()=>{void reader?.cancel().catch(()=>{});},{once:true});
    const chunks:Uint8Array[]=[];let total=0;
    while(true){const part=await reader.read();if(controller.signal.aborted)throw new ImageLoadError('CANCELLED','Consulta de imagem cancelada.');if(part.done)break;total+=part.value.length;if(total>MAX_IMAGE_BYTES)throw new ImageLoadError('SIZE','A imagem ultrapassa o limite de 8 MB.');chunks.push(part.value);}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    try{imageExtension(bytes);}catch(error){throw new ImageLoadError('FORMAT',error instanceof Error?error.message:'O arquivo da imagem é inválido ou corrompido.');}return bytes;
  }catch(error){
    if(timedOut)throw new ImageLoadError('TIMEOUT','O servidor demorou mais de 12 segundos para enviar a imagem. Tente novamente.');
    if(controller.signal.aborted)throw new ImageLoadError('CANCELLED','Consulta de imagem cancelada.');
    if(error instanceof ImageLoadError)throw error;
    throw new ImageLoadError('NETWORK','Não foi possível acessar a imagem. Confira sua conexão e tente novamente.');
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);try{await reader?.cancel();}catch{}reader?.releaseLock();}
}
export function createImageManager(storage: ImageStorage, request: typeof fetch) {
  return {
    async local(uri:string) {const bytes=await storage.readPicked(uri);const extension=imageExtension(bytes);return {bytes,extension,preview:await storage.temporary(bytes,extension)};},
    async remote(url:string,signal?:AbortSignal) {const bytes=await remoteImageBytes(url,request,signal);try{return await storage.temporary(bytes,imageExtension(bytes));}catch{throw new ImageLoadError('CACHE','Não foi possível preparar a prévia neste aparelho. Tente novamente ou escolha uma foto da galeria.');}},
    persist:(bytes:Uint8Array)=>storage.persist(bytes,imageExtension(bytes)),
    async display(reference:string,signal?:AbortSignal):Promise<ImagePreview|null> {
      if(isLocalImage(reference)){const uri=await storage.resolve(reference);return uri?{uri,release:()=>{}}:null;}
      return this.remote(reference,signal);
    },
  };
}

function checkedImage(bytes:Uint8Array,extension:string):string {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width=0,height=0;
  try {
    if(extension==='png'){width=view.getUint32(16);height=view.getUint32(20);}
    else if(extension==='gif'){width=view.getUint16(6,true);height=view.getUint16(8,true);}
    else if(extension==='jpg'){
      let p=2;while(p+4<bytes.length){if(bytes[p]!==255)break;const marker=bytes[p+1];if(marker===255){p++;continue;}if([0xd8,0x01,...Array.from({length:8},(_,i)=>0xd0+i)].includes(marker)){p+=2;continue;}const size=view.getUint16(p+2);if(size<2)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=view.getUint16(p+5);width=view.getUint16(p+7);break;}p+=2+size;}
    }else{
      let p=12;while(p+8<bytes.length){const type=String.fromCharCode(...bytes.slice(p,p+4));const size=view.getUint32(p+4,true),d=p+8;
        if(type==='VP8X'){width=(bytes[d+4]|bytes[d+5]<<8|bytes[d+6]<<16)+1;height=(bytes[d+7]|bytes[d+8]<<8|bytes[d+9]<<16)+1;break;}
        if(type==='VP8 '){width=view.getUint16(d+6,true)&16383;height=view.getUint16(d+8,true)&16383;break;}
        if(type==='VP8L'){const n=view.getUint32(d+1,true);width=(n&16383)+1;height=((n>>>14)&16383)+1;break;}p=d+size+(size%2);
      }
    }
  }catch{throw new Error('Arquivo de imagem incompleto ou corrompido.');}
  if(!width||!height||width>8192||height>8192||width*height>20000000)throw new Error('Escolha uma imagem válida de até 20 megapixels e 8192 pixels por lado.');
  return extension;
}

// Expo File.move updates the temporary object's URI to the destination.
// Cleanup must never follow that mutation and delete a persistent/shared image.
export async function writePhotoAtomically<T>(temporary:{uri:string;exists:boolean;create:()=>void;write:(bytes:Uint8Array)=>Promise<void>;move:(destination:T,options:{overwrite:boolean})=>Promise<void>;delete:()=>void},destination:T,bytes:Uint8Array){
  try{temporary.create();await temporary.write(bytes);await temporary.move(destination,{overwrite:true});}
  finally{if(temporary.uri.endsWith('.tmp')&&temporary.exists)temporary.delete();}
}
