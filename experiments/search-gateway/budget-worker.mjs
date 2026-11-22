// Isolated test worker: only experimental SQLite, never network/production.
import { parentPort, workerData } from 'node:worker_threads';
import { GatewayStore } from './store.ts';
const store = new GatewayStore(workerData.file, { cycle: 1, hour: 40, entries: 128, cacheBytes: 2000000 });
try {
    store.reserve('worker', workerData.now);
    parentPort.postMessage('reserved');
}
catch (e) {
    parentPort.postMessage(e.code ?? 'failed-closed');
}
finally {
    store.close();
}
