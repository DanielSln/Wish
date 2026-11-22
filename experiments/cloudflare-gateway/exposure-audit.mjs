/** Local inventory audit only. No deploy command, account, SDK or network. */
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('./remote-blockers.json',import.meta.url),'utf8'));
const verified=[],missing=[];
for(const item of manifest.items){
  if(!/^[a-zA-Z0-9_.-]+$/u.test(item.file)||!item.id||!item.replace||!item.marker){missing.push(item.id);continue;}
  try{const source=await readFile(new URL('./'+item.file,import.meta.url),'utf8');if(!source.includes(item.marker))missing.push(item.id);else verified.push(item.id);}catch{missing.push(item.id);}
}
const result={decision:'NO_GO',deploymentAllowed:false,verified,missingEvidence:missing,unresolved:manifest.items.map(i=>i.id)};
console.log(JSON.stringify(result));
// A deleted marker is stale evidence requiring review, never an automatic approval.
process.exitCode=missing.length?2:1;
