import { assess } from '../product-confidence/engine.ts';
import { compareProducts } from '../product-confidence/identity.ts';
import { plainData, record } from '../product-confidence/normalize.ts';
import { adapt, cachedCandidates } from './adapters.ts';
import { GatewayStore } from './store.ts';
import { fingerprint, queryFor, reference, validate } from './validation.ts';
import { GatewayError, type Engine, type GatewayResponse, type NormalizedCandidate, type Operation, type SearchProvider } from './contracts.ts';
interface Job {
    promise: Promise<{
        candidates: NormalizedCandidate[];
        warnings: ('DETAILS_UNAVAILABLE')[];
    }>;
    controller: AbortController;
    waiters: number;
}
interface GatewayOptions {
    clock?: () => number;
    identifyMs?: number;
    compareMs?: number;
    callMs?: number;
    maxIdentifyCalls?: number;
    maxCompareCalls?: number;
    redactions?: readonly string[];
}
export class SearchGateway {
    private flights = new Map<string, Job>();
    private requests = new Map<string, {
        key: string;
        controllers: Set<AbortController>;
    }>();
    readonly clock: () => number;
    readonly store: GatewayStore;
    readonly provider: SearchProvider;
    readonly options: GatewayOptions;
    constructor(store: GatewayStore, provider: SearchProvider, options: GatewayOptions = {}) {
        this.store = store;
        this.provider = provider;
        this.options = Object.freeze({ ...options });
        if (provider.kind !== 'simulated' || (options.maxIdentifyCalls ?? 1) < 1 || (options.maxIdentifyCalls ?? 1) > 1 || (options.maxCompareCalls ?? 2) < 1 || (options.maxCompareCalls ?? 2) > 2)
            throw new GatewayError('UNAVAILABLE');
        this.clock = options.clock ?? Date.now;
    }
    cancel(owner: string, id: string): boolean {
        const req = this.requests.get(`${owner}:${id}`);
        if (!req)
            return false;
        for (const controller of req.controllers)
            controller.abort();
        return true;
    }
    async execute(owner: string, operation: Operation, input: unknown, signal?: AbortSignal): Promise<GatewayResponse> {
        const now = this.clock(), request = validate(input, operation), key = fingerprint(request, owner), requestKey = `${owner}:${request.requestId}`;
        this.store.rate(`owner:${owner}`, now);
        if (signal?.aborted)
            throw new GatewayError('CANCELLED');
        const active = this.requests.get(requestKey);
        if (active && active.key !== key)
            throw new GatewayError('REQUEST_CONFLICT');
        const build = (data: NormalizedCandidate[], hit: boolean, obtained: number, commercialFresh: boolean, warnings: ('DETAILS_UNAVAILABLE')[] = []): GatewayResponse => {
            const ref = reference(request.product, now);
            const assessment = assess({ reference: ref, candidates: data, policy: { now: new Date(this.clock()).toISOString(), currency: 'BRL', maxPriceAgeMs: 900000, maxIdentityAgeMs: 86400000, purpose: operation === 'identify' ? 'original_listing' : 'comparison' } });
            if (assessment.errors.length)
                throw new GatewayError('INVALID_PROVIDER_DATA');
            return { version: 1, requestId: request.requestId, provider: 'simulated', queriedAt: new Date(obtained).toISOString(), referenceFingerprint: key, cache: hit ? 'hit' : 'miss', commercialFresh, partial: warnings.length > 0 || data.length === 0 || assessment.manualRequired || assessment.reviewOffers.length > 0, warnings, assessment };
        };
        const cache = this.store.cacheGet(key, owner, now, operation);
        if (cache) {
            const saved = plainData(cache.data);
            if (!record(saved) || !Array.isArray(saved.candidates) || !Array.isArray(saved.warnings) || !saved.warnings.every(x => x === 'DETAILS_UNAVAILABLE'))
                throw new GatewayError('UNAVAILABLE');
            return build(cachedCandidates(saved.candidates), true, cache.at, cache.commercialFresh, saved.warnings as ('DETAILS_UNAVAILABLE')[]);
        }
        let job = this.flights.get(key);
        if (job?.controller.signal.aborted) {
            this.flights.delete(key);
            job = undefined;
        }
        if (!job) {
            if (this.flights.size >= 8)
                throw new GatewayError('RATE_LIMITED');
            const controller = new AbortController();
            const created: Job = { controller, waiters: 0, promise: Promise.resolve({ candidates: [], warnings: [] }) };
            // Install the shared execution before its first asynchronous continuation.
            this.flights.set(key, created);
            created.promise = Promise.resolve().then(async () => {
                const start = this.clock();
                const deadline = operation === 'identify' ? (this.options.identifyMs ?? 3000) : (this.options.compareMs ?? 5000);
                let deadlineExpired = false;
                const timer = setTimeout(() => { deadlineExpired = true; controller.abort(); }, deadline);
                let count = 0;
                const output: NormalizedCandidate[] = [];
                const warnings: ('DETAILS_UNAVAILABLE')[] = [];
                const run = async (engine: Engine, query: string) => {
                    if (controller.signal.aborted)
                        throw new GatewayError(deadlineExpired ? 'TIMEOUT' : 'CANCELLED');
                    const max = operation === 'identify' ? (this.options.maxIdentifyCalls ?? 1) : (this.options.maxCompareCalls ?? 2);
                    if (count >= max)
                        throw new GatewayError('BUDGET_EXHAUSTED');
                    const reservation = this.store.reserve(key, this.clock());
                    count++;
                    const call = new AbortController();
                    const abort = () => call.abort();
                    controller.signal.addEventListener('abort', abort, { once: true });
                    const wait = Math.min(this.options.callMs ?? 2000, Math.max(1, deadline - (this.clock() - start)));
                    let timeout = false;
                    const callTimer = setTimeout(() => { timeout = true; call.abort(); }, wait);
                    try {
                        const response = await Promise.race([this.provider.search(engine, query, call.signal), new Promise<never>((_, reject) => {
                                if (call.signal.aborted)
                                    reject(new GatewayError(timeout ? 'TIMEOUT' : 'CANCELLED'));
                                else
                                    call.signal.addEventListener('abort', () => reject(new GatewayError(timeout ? 'TIMEOUT' : 'CANCELLED')), { once: true });
                            })]);
                        if (response.engine !== engine || response.simulation !== true)
                            throw new GatewayError('INVALID_PROVIDER_DATA');
                        const normalized = adapt(response, this.options.redactions);
                        this.store.finish(reservation, 'settled');
                        output.push(...normalized);
                        return response;
                    }
                    catch (error) {
                        this.store.finish(reservation, 'uncertain');
                        if (error instanceof GatewayError && error.code === 'INVALID_PROVIDER_DATA')
                            throw error;
                        throw new GatewayError(timeout || deadlineExpired ? 'TIMEOUT' : controller.signal.aborted ? 'CANCELLED' : 'UNAVAILABLE');
                    }
                    finally {
                        clearTimeout(callTimer);
                        controller.signal.removeEventListener('abort', abort);
                    }
                };
                try {
                    const first = await run(operation === 'identify' ? 'google' : 'google_shopping', queryFor(request.product));
                    if (operation === 'compare' && (this.options.maxCompareCalls ?? 2) > 1) {
                        // Inspect bounded data; never follow a provider URL. Token is private.
                        const raw = plainData(first.payload);
                        const rows = record(raw) && Array.isArray(raw.shopping_results) ? raw.shopping_results : [];
                        const wanted = request.product.model ?? request.product.identifiers?.find(i => i.scheme === 'mpn')?.value;
                        const ref = reference(request.product, now);
                        const selected = rows.find((row, i) => record(row) && typeof row.immersive_product_page_token === 'string' && row.immersive_product_page_token.length <= 4096 && wanted && output[i]?.product.fields.model?.value === wanted && compareProducts(ref, output[i].product, { now: new Date(now).toISOString(), currency: 'BRL', maxPriceAgeMs: 900000, maxIdentityAgeMs: 86400000, purpose: 'comparison' }).product !== 'incompatible');
                        if (record(selected)) {
                            try {
                                await run('google_immersive_product', String(selected.immersive_product_page_token));
                            }
                            catch (error) {
                                if (controller.signal.aborted && !deadlineExpired)
                                    throw error;
                                warnings.push('DETAILS_UNAVAILABLE');
                            }
                        }
                    }
                    if (controller.signal.aborted && !warnings.length)
                        throw new GatewayError(deadlineExpired ? 'TIMEOUT' : 'CANCELLED');
                    // Store only normalized, redacted data; never raw responses or tokens.
                    const result = { candidates: output, warnings };
                    this.store.cachePut(key, owner, result, this.clock(), output.length ? 86400000 : 60000, output.length ? 900000 : 60000);
                    return result;
                }
                finally {
                    clearTimeout(timer);
                    if (this.flights.get(key) === created)
                        this.flights.delete(key);
                }
            });
            job = created;
        }
        const shared = job;
        shared.waiters++;
        const local = new AbortController();
        const cancel = () => local.abort();
        signal?.addEventListener('abort', cancel, { once: true });
        // Same request id attaches to the same work; conflicting content is rejected.
        const requestGroup = this.requests.get(requestKey) ?? { key, controllers: new Set<AbortController>() };
        requestGroup.controllers.add(local);
        this.requests.set(requestKey, requestGroup);
        try {
            const data = await Promise.race([shared.promise, new Promise<never>((_, reject) => {
                    if (local.signal.aborted)
                        reject(new GatewayError('CANCELLED'));
                    else
                        local.signal.addEventListener('abort', () => reject(new GatewayError('CANCELLED')), { once: true });
                })]);
            return build(data.candidates, false, now, true, data.warnings);
        }
        catch (error) {
            throw error instanceof GatewayError ? error : new GatewayError('UNAVAILABLE');
        }
        finally {
            signal?.removeEventListener('abort', cancel);
            requestGroup.controllers.delete(local);
            if (!requestGroup.controllers.size)
                this.requests.delete(requestKey);
            shared.waiters--;
            if (shared.waiters === 0 && !shared.controller.signal.aborted)
                shared.controller.abort();
        }
    }
}
