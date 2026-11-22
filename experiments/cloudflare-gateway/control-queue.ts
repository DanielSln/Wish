import {GatewayError} from '../search-gateway/contracts.ts';
/** Persistent transitions still have one writer; only validated control tasks take priority. */
export class ControlQueue {
  normal: {run:()=>Promise<Response>;resolve:(r:Response)=>void;reject:(e:unknown)=>void}[]=[];
  control: typeof this.normal=[];
  running=false;
  submit(run:()=>Promise<Response>,urgent=false):Promise<Response>{
    const list=urgent?this.control:this.normal;
    if(list.length>=(urgent?4:16))throw new GatewayError('RATE_LIMITED');
    return new Promise((resolve,reject)=>{list.push({run,resolve,reject});void this.drain();});
  }
  private async drain(){
    if(this.running)return;this.running=true;
    try{for(;;){const task=this.control.shift()??this.normal.shift();if(!task)break;try{task.resolve(await task.run());}catch(e){task.reject(e);}}}finally{this.running=false;}
  }
}
