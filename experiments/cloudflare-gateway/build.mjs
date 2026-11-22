const personal = process.argv[2] === 'personal';
import { build } from './.tools/node_modules/esbuild/lib/main.js';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir(new URL('./.local/', import.meta.url), { recursive: true });
const result = await build({ entryPoints: [new URL(personal ? './personal-worker.ts' : './worker.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', external: ['node:crypto'], outfile: new URL(personal ? './.local/personal.mjs' : './.local/worker.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), metafile: true, minify: true });
const inputs = Object.keys(result.metafile.inputs);
if (inputs.some(p => /(?:search-gateway\/(?:store|http|cli)\.ts|src\/|node_modules)/u.test(p.replaceAll('\\', '/'))))
    throw Error('Forbidden runtime dependency');
await writeFile(new URL(personal ? './.local/personal-meta.json' : './.local/bundle-meta.json', import.meta.url), JSON.stringify(result.metafile, null, 2));
console.log(JSON.stringify({ bundleInputs: inputs, bytes: Object.values(result.metafile.outputs)[0].bytes }));
