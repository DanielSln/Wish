import { mkdirSync, openSync, writeFileSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GatewayStore } from './store.ts';
import { MockProvider } from './provider.ts';
import { SearchGateway } from './gateway.ts';
import { localServer } from './http.ts';
export async function startLocal(port = 4318) {
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
        throw new Error('INVALID_PORT');
    const root = resolve('.expo/search-gateway');
    mkdirSync(root, { recursive: true });
    const lockPath = resolve(root, 'owner.lock'), lock = openSync(lockPath, 'wx', 0o600);
    let store: GatewayStore;
    try {
        store = new GatewayStore(resolve(root, 'local.gateway.sqlite'));
    }
    catch (error) {
        closeSync(lock);
        unlinkSync(lockPath);
        throw error;
    }
    let closed = false;
    const closeLock = () => {
        if (!closed) {
            closed = true;
            store.close();
            closeSync(lock);
            unlinkSync(lockPath);
        }
    };
    try {
        store.recoverPending();
        const now = Date.now();
        if (!store.stats().cycleId)
            store.reconcile({ simulation: true, free: true, cycleId: 'mock-free-initial', startsAt: Date.parse('2026-11-21T00:00:00Z'), renewsAt: Date.parse('2026-12-21T00:00:00Z'), observedAt: now, remaining: 236, used: 14, monthlyLimit: 250 }, now);
        const token = store.issueSession('owner', now);
        const sessionFile = resolve(root, 'owner-session.json');
        writeFileSync(sessionFile, JSON.stringify({ provider: 'simulated', token, expiresAt: new Date(now + 3600000).toISOString() }), { mode: 0o600 });
        const gateway = new SearchGateway(store, new MockProvider());
        const server = localServer(store, gateway);
        server.once('close', closeLock);
        await new Promise<void>((done, reject) => { server.once('error', reject); server.listen({ port, host: '127.0.0.1', exclusive: true }, () => done()); });
        const address = server.address();
        console.log(JSON.stringify({ provider: 'simulated', baseUrl: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`, sessionFile }));
        const stop = () => { server.close(); server.closeAllConnections(); };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
        return { server, stop };
    }
    catch (error) {
        closeLock();
        throw error;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
    startLocal(process.argv[2] ? Number(process.argv[2]) : 4318).catch(() => { console.error('Serviço local indisponível. Verifique porta, estado e lock experimental; nenhum detalhe privado foi registrado.'); process.exitCode = 1; });
