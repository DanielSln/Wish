/** Minimal structural runtime ports, exercised against workerd; not production bindings. */
export type Value = string | number | null;
export interface Cursor<T = Record<string, Value>> extends Iterable<T> {
    toArray(): T[];
    rowsRead: number;
    rowsWritten: number;
}
export interface Storage {
    sql: {
        exec<T = Record<string, Value>>(query: string, ...values: Value[]): Cursor<T>;
    };
    transactionSync<T>(callback: () => T): T;
    sync(): Promise<void>;
}
export interface State {
    storage: Storage;
}
export interface Stub {
    fetch(request: Request): Promise<Response>;
}
export interface Namespace {
    idFromName(name: string): unknown;
    get(id: unknown): Stub;
}
export interface Session {
    hash: string;
    owner: string;
    expires: number;
    revoked?: boolean;
}
export interface Environment {
    COORDINATOR: Namespace;
    LOCAL_TEST_ONLY: string;
    INTERNAL_TOKEN: string;
    SESSIONS: string;
    SNAPSHOT: string;
    MOCK_MODE?: 'fast' | 'slow' | 'timeout' | 'failure' | 'partial';
    MOCK_PAYLOADS?: string;
    MOCK_DETAILS_FAILURE?: string;
    MOCK_WAIT_GATE?: string;
}
