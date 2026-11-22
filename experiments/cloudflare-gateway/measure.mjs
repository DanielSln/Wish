import { runtime, identify, compare } from './harness.mjs';
import { writeFile, stat, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
async function inspector(mf) {
    const address = await mf.getInspectorURL();
    address.protocol = 'http:';
    address.hostname = '127.0.0.1';
    address.pathname = '/json';
    const targets = await (await fetch(address)).json();
    const target = targets.find(t => t.id === 'core:user:wish-local-only');
    if (!target || new URL(target.webSocketDebuggerUrl).hostname !== '127.0.0.1')
        throw Error('No isolated target');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map();
    let id = 0;
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    socket.addEventListener('message', e => {
        const data = JSON.parse(e.data);
        if (data.id) {
            const p = pending.get(data.id);
            if (!p)
                return;
            pending.delete(data.id);
            clearTimeout(p.timer);
            if (data.error)
                p.reject(Error(data.error.message));
            else
                p.resolve(data.result);
        }
    });
    return { send(method, params = {}) { return new Promise((resolve, reject) => { const current = ++id; const timer = setTimeout(() => { pending.delete(current); reject(Error('Local inspector timeout')); }, 5000); pending.set(current, { resolve, reject, timer }); socket.send(JSON.stringify({ id: current, method, params })); }); }, close() { socket.close(); } };
}
const r = await runtime({ inspect: true });
let cdp;
try {
    cdp = await inspector(r.mf);
    const heapBefore = await cdp.send('Runtime.getHeapUsage');
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    await cdp.send('Profiler.start');
    const latencies = [];
    for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const out = await r.call(identify('measure-' + i, 'Headphones ' + i));
        if (out.status !== 200)
            throw Error('Unexpected identify status');
        latencies.push({ operation: 'identify', ms: performance.now() - start, responseBytes: Buffer.byteLength(JSON.stringify(out.data)) });
    }
    for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const body = compare('compare-' + i);
        body.product.color = 'color ' + i;
        const out = await r.call(body, '/v1/compare');
        if (out.status !== 200)
            throw Error('Unexpected compare status');
        latencies.push({ operation: 'compare', ms: performance.now() - start, responseBytes: Buffer.byteLength(JSON.stringify(out.data)) });
    }
    const { profile } = await cdp.send('Profiler.stop');
    const heapAfter = await cdp.send('Runtime.getHeapUsage');
    await writeFile(new URL('./.local/local.cpuprofile', import.meta.url), JSON.stringify(profile));
    const nodes = new Map(profile.nodes.map(n => [n.id, n]));
    let activeSamples = 0, activeSampledUs = 0;
    for (let i = 0; i < (profile.samples ?? []).length; i++)
        if (!['(idle)', '(program)', '(root)'].includes(nodes.get(profile.samples[i])?.callFrame.functionName)) {
            activeSamples++;
            activeSampledUs += profile.timeDeltas?.[i] ?? 0;
        }
    const bundle = await readFile(new URL('./.local/worker.mjs', import.meta.url));
    const result = { localOnly: true, runtime: 'workerd 1.20260730.1', startupHarnessMs: r.startupMs, bundleBytes: (await stat(new URL('./.local/worker.mjs', import.meta.url))).size, gzipBundleBytes: gzipSync(bundle).length, heapBefore, heapAfter, cpuSampling: { samples: profile.samples?.length, activeSamples, activeSampledUs, profileWallUs: profile.endTime - profile.startTime, warning: 'Sampling estimate for combined Worker/DO isolate, not metered CPU per request; idle/program excluded. No Free CPU or memory guarantee.' }, latencies, sqlite: (await r.control('stats')).data, outbound: r.outbound() };
    await writeFile(new URL('./.local/performance.json', import.meta.url), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
}
finally {
    cdp?.close();
    await r.close();
}
