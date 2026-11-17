import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const expectedBranch = 'feature/expo-go-readiness';
const expectedSchema = 4;
try {
  const branch = git('branch','--show-current');
  const commit = git('rev-parse','--short','HEAD');
  const source = readFileSync(resolve(root,'src/data/migrations.ts'),'utf8');
  const schema = Number(source.match(/user_version\s*\?\?\s*0\)\s*>\s*(\d+)/)?.[1]);
  if (schema !== expectedSchema || ![expectedBranch,'main'].includes(branch)) throw new Error(`Prévia recusada: branch ${branch || '(detached)'}, esquema ${schema || 'desconhecido'}. Esperado ${expectedBranch} ou main já integrada, esquema ${expectedSchema}.`);
  console.log(`Wish | ${root}\nBranch: ${branch} | Commit: ${commit} | SQLite: v${schema}\nUse este servidor apenas com o catálogo compatível. Não limpe dados para contornar incompatibilidades.`);
  if (process.argv.includes('--check')) process.exit(0);
  const cli = resolve(root,'node_modules/expo/bin/cli');
  const child = spawn(process.execPath,[cli,'start',...process.argv.slice(2)],{cwd:root,stdio:'inherit',env:process.env});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;});
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode=1; }
