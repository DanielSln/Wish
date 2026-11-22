import { createServer, type IncomingMessage } from 'node:http';
import { GatewayStore } from './store.ts';
import { SearchGateway } from './gateway.ts';
import { GatewayError, STATUS } from './contracts.ts';
import { redact } from './validation.ts';
export type SafeEvent = {
    event: 'response';
    status: number;
    elapsedMs: number;
};
async function body(req: IncomingMessage): Promise<unknown> {
    const type = req.headers['content-type'];
    if (!type || !/^application\/json(?:;\s*charset=utf-8)?$/iu.test(type) || req.headers['content-encoding'])
        throw new GatewayError('INVALID_REQUEST');
    if (Number(req.headers['content-length']) > 32768)
        throw new GatewayError('TOO_LARGE');
    return new Promise((resolve, reject) => {
        const parts: Buffer[] = [];
        let size = 0;
        const cleanup = () => { clearTimeout(timer); req.removeListener('data', onData); req.removeListener('end', onEnd); req.removeListener('error', onError); req.removeListener('aborted', onAbort); };
        const fail = (error: GatewayError) => { cleanup(); req.pause(); reject(error); };
        const onData = (chunk: Buffer) => {
            size += chunk.length;
            if (size > 32768) {
                fail(new GatewayError('TOO_LARGE'));
                return;
            }
            parts.push(chunk);
        };
        const onEnd = () => {
            cleanup();
            try {
                resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts))));
            }
            catch {
                reject(new GatewayError('INVALID_REQUEST'));
            }
        };
        const onError = () => fail(new GatewayError('INVALID_REQUEST'));
        const onAbort = () => fail(new GatewayError('CANCELLED'));
        const timer = setTimeout(() => fail(new GatewayError('TIMEOUT')), 2000);
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('error', onError);
        req.once('aborted', onAbort);
    });
}
export function localServer(store: GatewayStore, gateway: SearchGateway, observe: (event: SafeEvent) => void = () => { }) {
    const server = createServer(async (req, res) => {
        const started = Date.now();
        let bearer = '';
        const stop = new AbortController();
        req.on('aborted', () => stop.abort());
        res.on('close', () => {
            if (!res.writableEnded)
                stop.abort();
        });
        try {
            const address = server.address();
            const port = address && typeof address === 'object' ? address.port : 0;
            if (req.socket.remoteAddress !== '127.0.0.1' || req.headers.host !== `127.0.0.1:${port}` || req.headers.origin || req.headers['sec-fetch-site'] === 'cross-site')
                throw new GatewayError('UNAUTHORIZED');
            store.rate('loopback', gateway.clock(), 60);
            if (req.rawHeaders.filter(v => v.toLowerCase() === 'authorization').length !== 1)
                throw new GatewayError('UNAUTHORIZED');
            bearer = String(req.headers.authorization ?? '').replace(/^Bearer /u, '');
            const owner = store.authenticate(req.headers.authorization, gateway.clock());
            if (req.method !== 'POST' || !['/v1/identify', '/v1/compare', '/v1/cancel'].includes(req.url ?? ''))
                throw new GatewayError('INVALID_REQUEST');
            const parsed = await body(req);
            let response: unknown;
            if (req.url === '/v1/cancel') {
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some(k => !['version', 'requestId'].includes(k)) || (parsed as {
                    version?: unknown;
                }).version !== 1 || typeof (parsed as {
                    requestId?: unknown;
                }).requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/u.test((parsed as {
                    requestId: string;
                }).requestId))
                    throw new GatewayError('INVALID_REQUEST');
                response = { version: 1, provider: 'simulated', cancelled: gateway.cancel(owner, (parsed as {
                        requestId: string;
                    }).requestId) };
            }
            else
                response = await gateway.execute(owner, req.url === '/v1/compare' ? 'compare' : 'identify', parsed, stop.signal);
            const output = redact(JSON.stringify(response), bearer ? [bearer] : []);
            if (Buffer.byteLength(output) > 500000)
                throw new GatewayError('UNAVAILABLE');
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
            res.end(output);
        }
        catch (error) {
            const code = error instanceof GatewayError ? error.code : 'UNAVAILABLE';
            if (!res.headersSent && !res.destroyed) {
                res.writeHead(STATUS[code], { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'connection': 'close' });
                res.end(JSON.stringify({ version: 1, provider: 'simulated', error: { code, manualAvailable: true } }));
            }
        }
        finally {
            try {
                observe({ event: 'response', status: res.statusCode, elapsedMs: Math.max(0, Date.now() - started) });
            }
            catch { /* Telemetry cannot alter the response. */ }
        }
    });
    server.headersTimeout = 5000;
    server.requestTimeout = 10000;
    server.keepAliveTimeout = 1000;
    server.maxHeadersCount = 24;
    server.setTimeout(7000, socket => socket.destroy());
    server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
    return server;
}
