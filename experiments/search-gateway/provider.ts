import { GatewayError, type Engine, type ProviderResult, type SearchProvider } from './contracts.ts';
import { fixtures } from './fixtures.ts';
/** Future request descriptor only; deliberately has no send/key/env capability. */
export function serpDescriptor(engine: Engine, query: string) {
    if (!['google', 'google_shopping', 'google_immersive_product'].includes(engine) || !query || query.length > 4096)
        throw new GatewayError('INVALID_REQUEST');
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', engine);
    if (engine === 'google_immersive_product')
        url.searchParams.set('page_token', query);
    else {
        url.searchParams.set('q', query);
        url.searchParams.set('gl', 'br');
        url.searchParams.set('hl', 'pt');
        url.searchParams.set('google_domain', 'google.com.br');
    }
    return { method: 'GET' as const, url: url.href, redirect: 'error' as const, enabled: false as const };
}
interface MockOptions {
    mode?: 'fast' | 'slow' | 'timeout' | 'failure' | 'partial';
    delayMs?: number;
    payloads?: Partial<Record<Engine, unknown>>;
    clock?: () => number;
}
export class MockProvider implements SearchProvider {
    readonly kind = 'simulated' as const;
    calls = 0;
    readonly options: MockOptions;
    constructor(options: MockOptions = {}) { this.options = options; }
    async search(engine: Engine, _query: string, signal: AbortSignal): Promise<ProviderResult> {
        this.calls++;
        if (signal.aborted)
            throw new GatewayError('CANCELLED');
        if (this.options.mode === 'failure')
            throw new Error('Simulated private provider exception; not exposed');
        const delay = this.options.delayMs ?? (this.options.mode === 'slow' ? 100 : 1);
        await new Promise<void>((resolve, reject) => {
            const abort = () => { clearTimeout(timer); reject(new GatewayError('CANCELLED')); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, this.options.mode === 'timeout' ? 60000 : delay);
            signal.addEventListener('abort', abort, { once: true });
        });
        const payload = this.options.payloads?.[engine] ?? (this.options.mode === 'partial' ? { organic_results: [{ title: 'Partial fixture only' }] } : fixtures[engine]);
        const synthetic = !!this.options.payloads?.[engine] || this.options.mode === 'partial';
        return { engine, payload, observedAt: synthetic ? new Date((this.options.clock ?? Date.now)()).toISOString() : '2026-11-21T00:00:00Z', timePrecision: synthetic ? 'instant' : 'day', simulation: true };
    }
}
