/** Experimental contracts. No provider, UI, database, clock or network dependency. */
export type Origin = 'store_page' | 'search_index' | 'manual' | 'cache' | 'insufficient';
export interface Provenance {
    kind: Origin;
    sourceId: string;
    observedAt: string;
    url?: string;
    cachedFrom?: Exclude<Origin, 'cache'>;
    timePrecision?: 'instant' | 'day';
}
export interface Evidence<T> {
    value: T;
    provenance: Provenance;
    explicit: boolean;
}
export type Field = 'name' | 'brand' | 'model' | 'color' | 'variant' | 'generation' | 'capacity' | 'size' | 'quantity' | 'store' | 'seller' | 'condition' | 'originalUrl' | 'role' | 'connectivity' | 'category' | 'description' | 'image';
export type Scheme = 'gtin' | 'mpn' | 'sku' | 'asin' | 'catalog' | 'listing';
export interface Identifier {
    scheme: Scheme;
    namespace?: string;
    evidence: Evidence<string>;
}
export interface Product {
    fields: Partial<Record<Field, Evidence<string | number>>>;
    identifiers: Identifier[];
}
export type Match = 'exact' | 'probable' | 'ambiguous' | 'incompatible' | 'unconfirmed';
export interface Reason {
    code: string;
    field?: string;
    detail?: string;
}
export interface Identity {
    product: Match;
    listing: Match;
    reasons: Reason[];
    conflicts: Reason[];
    anchors: string[];
    requiresReview: boolean;
}
export interface Money {
    minorUnits: number;
    currency: string;
}
export type PriceRole = 'advertised' | 'reported_total' | 'installment' | 'cash' | 'pix' | 'coupon_final' | 'conditional' | 'previous' | 'shipping' | 'additional_cost';
export type Basis = 'product_total' | 'delivered_total' | 'unknown';
export interface PriceFact {
    role: PriceRole;
    amount?: Evidence<Money>;
    basis: Basis;
    condition?: Evidence<string>;
    couponCode?: Evidence<string>;
    installmentCount?: Evidence<number>;
    rawText?: Evidence<string>;
}
export interface Offer {
    id: string;
    product: Product;
    prices: PriceFact[];
    availability?: Evidence<'in_stock' | 'out_of_stock' | 'unknown'>;
    commercialUrl?: Evidence<string>;
}
export interface Policy {
    now: string;
    currency: string;
    maxPriceAgeMs: number;
    maxIdentityAgeMs: number;
    purpose: 'original_listing' | 'comparison';
}
export interface Quote {
    offerId: string;
    role: PriceRole;
    amount: Evidence<Money>;
    basis: Exclude<Basis, 'unknown'>;
    condition?: Evidence<string>;
    couponCode?: Evidence<string>;
    group: string;
    status: 'eligible' | 'conditional' | 'review';
    reasons: Reason[];
}
export interface OfferAssessment {
    offerId: string;
    inputEvidence: Product;
    identity: Identity;
    status: 'eligible' | 'conditional' | 'review' | 'rejected';
    reasons: Reason[];
    quotes: Quote[];
    prices: PriceFact[];
}
export interface FieldSuggestions {
    suggest: Partial<Product['fields']>;
    review: Field[];
    empty: Field[];
}
export interface CandidateAssessment {
    id: string;
    inputEvidence: Product;
    identity: Identity;
    fields: FieldSuggestions;
    offers: OfferAssessment[];
}
export interface Assessment {
    candidates: CandidateAssessment[];
    eligibleOffers: Quote[];
    conditionalOffers: Quote[];
    reviewOffers: OfferAssessment[];
    rejectedOffers: OfferAssessment[];
    manualRequired: boolean;
    errors: Reason[];
}
