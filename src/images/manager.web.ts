import {fetch as expoFetch} from 'expo/fetch';
import {createImageManager,type ImageStorage} from '@/domain/image-management';
const storage:ImageStorage={
  async readPicked(){throw new Error('Use o Expo Go no celular para salvar fotos da galeria.');},
  async persist(){throw new Error('Fotos locais persistentes estão disponíveis no celular.');},
  async resolve(){return null;},
  async temporary(bytes,extension){const types:Record<string,string>={jpg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'};const uri=URL.createObjectURL(new Blob([bytes as BlobPart],{type:types[extension]}));return {uri,release:()=>URL.revokeObjectURL(uri)};},
};
export const imageManager=createImageManager(storage,expoFetch as typeof fetch);
