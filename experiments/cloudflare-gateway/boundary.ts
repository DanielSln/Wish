import { GatewayError, STATUS } from '../search-gateway/contracts.ts';
export function response(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }); }
export function failure(e: unknown) { const code = e instanceof GatewayError ? e.code : 'UNAVAILABLE'; return response({ error: code, simulation: true }, STATUS[code]); }
export async function read(request: Request): Promise<unknown> {
    if (request.headers.get('content-type') !== 'application/json')
        throw new GatewayError('INVALID_REQUEST');
    if (Number(request.headers.get('content-length') ?? 0) > 32768)
        throw new GatewayError('TOO_LARGE');
    const reader = request.body?.getReader();
    if (!reader)
        throw new GatewayError('INVALID_REQUEST');
    const parts: Uint8Array[] = [];
    let bytes = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([(async () => {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    bytes += value.length;
                    if (bytes > 32768)
                        throw new GatewayError('TOO_LARGE');
                    parts.push(value);
                }
                const all = new Uint8Array(bytes);
                let at = 0;
                for (const p of parts) {
                    all.set(p, at);
                    at += p.length;
                }
                try {
                    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all)) as unknown;
                }
                catch {
                    throw new GatewayError('INVALID_REQUEST');
                }
            })(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new GatewayError('TIMEOUT')), 2000); })]);
    }
    finally {
        clearTimeout(timer);
        void reader.cancel().catch(() => { });
    }
}
