/// <reference types="node" />
import type { Assessment, Product } from '../product-confidence/contracts.ts';
export type Operation = 'identify' | 'compare';
export type Engine = 'google' | 'google_shopping' | 'google_immersive_product';
export interface InputProduct {
    name?: string;
    brand?: string;
    model?: string;
    category?: string;
    color?: string;
    variant?: string;
    generation?: string;
    capacity?: string;
    size?: string;
    quantity?: number;
    condition?: string;
    role?: string;
    connectivity?: string;
    originalUrl?: string;
    identifiers?: {
        scheme: string;
        namespace?: string;
        value: string;
    }[];
}
export interface SearchRequest {
    version: 1;
    requestId: string;
    operation: Operation;
    product: InputProduct;
    confirmedByOwner?: boolean;
}
export interface NormalizedCandidate {
    id: string;
    product: Product;
    offers: import('../product-confidence/contracts.ts').Offer[];
}
export interface ProviderResult {
    engine: Engine;
    payload: unknown;
    observedAt: string;
    simulation: true;
    timePrecision?: 'instant' | 'day';
}
export interface SearchProvider {
    kind: 'simulated';
    search(engine: Engine, query: string, signal: AbortSignal): Promise<ProviderResult>;
}
export interface Snapshot {
    simulation: true;
    free: true;
    cycleId: string;
    startsAt: number;
    renewsAt: number;
    observedAt: number;
    remaining: number;
    used: number;
    monthlyLimit: 250;
}
export interface GatewayResponse {
    version: 1;
    requestId: string;
    provider: 'simulated';
    queriedAt: string;
    referenceFingerprint: string;
    cache: 'miss' | 'hit';
    commercialFresh: boolean;
    partial: boolean;
    warnings: ('DETAILS_UNAVAILABLE')[];
    assessment: Assessment;
}
export type ErrorCode = 'UNAUTHORIZED' | 'INVALID_REQUEST' | 'TOO_LARGE' | 'RATE_LIMITED' | 'BUDGET_EXHAUSTED' | 'BUDGET_STALE' | 'BUDGET_INCONSISTENT' | 'UNAVAILABLE' | 'TIMEOUT' | 'CANCELLED' | 'REQUEST_CONFLICT' | 'INVALID_PROVIDER_DATA';
export class GatewayError extends Error {
    readonly code: ErrorCode;
    constructor(code: ErrorCode) { super(code); this.code = code; }
}
export const STATUS: Record<ErrorCode, number> = { UNAUTHORIZED: 401, INVALID_REQUEST: 400, TOO_LARGE: 413, RATE_LIMITED: 429, BUDGET_EXHAUSTED: 429, BUDGET_STALE: 503, BUDGET_INCONSISTENT: 503, UNAVAILABLE: 503, TIMEOUT: 504, CANCELLED: 409, REQUEST_CONFLICT: 409, INVALID_PROVIDER_DATA: 502 };
