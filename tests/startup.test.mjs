import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
test('startup guard rejects old schema or wrong branch and accepts compatible main/review branch',()=>{
 const root=mkdtempSync(join(tmpdir(),'wish-start-'));
 try{
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'src/data'),{recursive:true});copyFileSync(new URL('../scripts/start-expo.mjs',import.meta.url),join(root,'scripts/start-expo.mjs'));
  const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'ignore'});
  git('init','-b','main');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
  const schema=n=>writeFileSync(join(root,'src/data/migrations.ts'),`if ((version?.user_version ?? 0) > ${n}) throw new Error('future');`);
  const run=()=>spawnSync(process.execPath,['scripts/start-expo.mjs','--check'],{cwd:root,encoding:'utf8'});
  schema(2);assert.equal(run().status,1);schema(4);assert.equal(run().status,0);
  git('switch','-c','feature/other');assert.equal(run().status,1);
  git('switch','-c','feature/expo-go-readiness');assert.equal(run().status,0);
  git('switch','-c','feature/product-images-ux');assert.equal(run().status,0);
 }finally{rmSync(root,{recursive:true,force:true})}
});
