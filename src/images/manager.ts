import {Directory,File,Paths} from 'expo-file-system';
import {digest,CryptoDigestAlgorithm,randomUUID} from 'expo-crypto';
import {fetch as expoFetch} from 'expo/fetch';
import {createImageManager,writePhotoAtomically,MAX_IMAGE_BYTES,localImagePattern,type ImageStorage} from '@/domain/image-management';
const pending=new Map<string,Promise<string>>();
const directory=()=>new Directory(Paths.document,'wish-product-images');
const storage:ImageStorage={
  async readPicked(uri){
    if(!/^(file|content):/.test(uri))throw new Error('O seletor não retornou um arquivo local.');
    const file=new File(uri);if(!file.exists || file.size<=0 || file.size>MAX_IMAGE_BYTES)throw new Error('Escolha uma imagem de até 8 MB.');
    return file.bytes();
  },
  async persist(bytes,extension){
    const buffer=await digest(CryptoDigestAlgorithm.SHA256,new Uint8Array(bytes).buffer);
    const hash=Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
    const reference=`wish-image://${hash}.${extension}`;
    const existing=pending.get(reference);if(existing)return existing;
    const task=(async()=>{const folder=directory();folder.create({idempotent:true,intermediates:true});const file=new File(folder,`${hash}.${extension}`);let valid=false;if(file.exists&&file.size===bytes.length){const existing=await digest(CryptoDigestAlgorithm.SHA256,new Uint8Array(await file.bytes()).buffer);valid=Array.from(new Uint8Array(existing),b=>b.toString(16).padStart(2,'0')).join('')===hash;}if(!valid){const temporary=new File(folder,randomUUID()+'.tmp');await writePhotoAtomically(temporary,file,bytes);}return reference;})();
    pending.set(reference,task);try{return await task;}finally{pending.delete(reference);}
  },
  async resolve(reference){const match=localImagePattern.exec(reference);if(!match)return null;try{const file=new File(directory(),`${match[1]}.${match[2]}`);return file.exists&&file.size>0&&file.size<=MAX_IMAGE_BYTES?file.uri:null;}catch{return null;}},
  async temporary(bytes,extension){const folder=new Directory(Paths.cache,'wish-image-previews');folder.create({idempotent:true,intermediates:true});const file=new File(folder,`${randomUUID()}.${extension}`);file.create();await file.write(bytes);return {uri:file.uri,release:()=>{try{if(file.exists)file.delete();}catch{/* Cache cleanup never affects the persistent photo. */}}};},
};
export const imageManager=createImageManager(storage,expoFetch as typeof fetch);
