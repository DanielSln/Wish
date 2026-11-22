import {suggestCategory} from './category-suggestion.ts';
import {importDraft} from './import-draft.ts';
import type {Category,ProductInput} from './product.ts';
import {manualProductFromLink,type ImportPreview} from '../services/product-import.ts';
export type ImportPhase='idle'|'fetching'|'reading'|'extracting'|'editing'|'saving'|'saved';
export interface ImportToken {generation:number;url:string;signal:AbortSignal}
export interface ImportState {url:string;draft:ProductInput|null;preview:ImportPreview|null;phase:ImportPhase;message:string;dirty:readonly (keyof ProductInput)[]}
/** In-memory intent only: no persistence, timers, network or experimental imports. */
export class ImportSession {
  private state:ImportState={url:'',draft:null,preview:null,phase:'idle',message:'',dirty:[]};
  private generation=0;
  private controller:AbortController|null=null;
  private categories:Category[]=[];
  private listeners=new Set<()=>void>();
  getSnapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<ImportState>){this.state={...this.state,...patch};for(const notify of this.listeners)notify();}
  private invalidate(){this.generation++;this.controller?.abort();this.controller=null;}
  private sealed(){return this.state.phase==='saving'||this.state.phase==='saved';}
  select(url:string){
    if(this.sealed()||url===this.state.url)return;
    this.invalidate();
    if(!url){this.publish({url,draft:null,preview:null,phase:'idle',message:'',dirty:[]});return;}
    try{
      const value=manualProductFromLink(url);
      const draft=importDraft({name:'',description:'',image_url:'',price_cents:null,store:value.store??'',original_url:value.original_url??'',notes:'',offer_details:'Cadastro manual. Preço não confirmado; link original preservado.'},this.categories);
      this.publish({url,draft,preview:null,phase:'idle',message:'',dirty:[]});
    }catch(e){this.publish({url,draft:null,preview:null,phase:'idle',message:e instanceof Error?e.message:'Informe um link válido.',dirty:[]});}
  }
  setCategories(categories:Category[]){
    this.categories=categories;
    if(this.sealed()||!this.state.draft)return;
    const draft={...this.state.draft};
    if(!this.state.dirty.includes('category_id'))draft.category_id=suggestCategory(draft.name,categories,this.state.preview?.product.category_hint,draft.description)??'';
    this.publish({draft});
  }
  edit<K extends keyof ProductInput>(key:K,value:ProductInput[K]){
    if(this.sealed()||this.state.phase==='editing'||!this.state.draft)return;
    const dirty=[...new Set([...this.state.dirty,key])],draft={...this.state.draft,[key]:value};
    if(key==='name'&&!dirty.includes('category_id'))draft.category_id=suggestCategory(String(value),this.categories,this.state.preview?.product.category_hint,draft.description)??'';
    this.publish({draft,dirty});
  }
  begin():ImportToken|null{
    if(this.sealed()||this.state.phase==='editing'||this.controller||!this.state.draft)return null;
    this.invalidate();this.controller=new AbortController();
    const token={generation:this.generation,url:this.state.url,signal:this.controller.signal};
    this.publish({phase:'fetching',message:''});return token;
  }
  private current(token:ImportToken){return token.generation===this.generation&&token.url===this.state.url&&this.controller?.signal===token.signal&&!token.signal.aborted&&!this.sealed()&&this.state.phase!=='editing';}
  progress(token:ImportToken,phase:'fetching'|'reading'|'extracting'){if(this.current(token)&&phase!==this.state.phase)this.publish({phase});}
  complete(token:ImportToken,preview:ImportPreview){
    if(!this.current(token)||!this.state.draft)return false;
    const patch:Partial<ProductInput>={};
    for(const key of ['name','description','image_url','price_cents','store','notes','offer_details'] as const){if(!this.state.dirty.includes(key))Object.assign(patch,{[key]:key==='price_cents'?preview.product.price_cents:preview.product[key]??''});}
    const draft={...this.state.draft,...patch};
    // Original link, personal notes, status and priority are never rewritten by a response.
    if(!this.state.dirty.includes('category_id'))draft.category_id=suggestCategory(draft.name,this.categories,preview.product.category_hint,draft.description)??'';
    this.controller=null;this.publish({draft,preview,phase:'idle',message:''});return true;
  }
  fail(token:ImportToken,message:string){if(!this.current(token))return false;this.controller=null;this.publish({phase:'idle',message});return true;}
  cancel(message='Consulta cancelada. Seus campos foram preservados.'){
    if(this.sealed())return;this.invalidate();this.publish({phase:'idle',message});
  }
  openEditor(){if(this.sealed())return null;this.invalidate();this.publish({phase:'editing',message:''});return this.state.draft?{...this.state.draft}:{};}
  closeEditor(){if(this.state.phase==='editing')this.publish({phase:'idle'});}
  beginSave(){if(this.sealed()||!this.state.draft)return null;this.invalidate();this.publish({phase:'saving',message:''});return {...this.state.draft};}
  saveFailed(message:string){if(this.state.phase==='saving')this.publish({phase:'idle',message});}
  saved(){this.invalidate();this.publish({phase:'saved',message:''});}
}
