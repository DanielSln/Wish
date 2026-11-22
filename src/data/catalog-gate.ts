export type Maintenance = {
    busy: boolean;
    message: string;
    cancellable: boolean;
    revision: number;
    fault: string;
    result: string;
};
// One gate per SQLite connection coordinates all repository, theme and maintenance work.
// A revision invalidates mounted forms after a confirmed catalogue replacement.
export class CatalogGate {
    private pendingRevision = false;
    private cancelAction: (() => void) | null = null;
    private tail: Promise<unknown> = Promise.resolve();
    private state: Maintenance = { busy: false, message: '', cancellable: false, revision: 0, fault: '', result: '' };
    private listeners = new Set<() => void>();
    getSnapshot = () => this.state;
    subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
    update(patch: Partial<Maintenance>) { this.state = { ...this.state, ...patch }; for (const f of this.listeners)
        f(); }
    run<T>(action: () => Promise<T>): Promise<T> { if (this.state.busy || this.state.fault)
        return Promise.reject(Error(this.state.fault || 'Backup em andamento. Aguarde antes de alterar o catálogo.')); const result = this.tail.then(() => { if (this.state.busy || this.state.fault)
        throw Error(this.state.fault || 'Backup em andamento. Tente novamente ao concluir.'); return action(); }); this.tail = result.catch(() => { }); return result; }
    async exclusive<T>(message: string, action: () => Promise<T>) { if (this.state.busy)
        throw Error('Já existe uma operação de backup em andamento.'); this.update({ busy: true, message, cancellable: true }); const result = this.tail.then(action); this.tail = result.catch(() => { }); try {
        return await result;
    }
    finally {
        const revision = this.state.revision + (this.pendingRevision ? 1 : 0);
        this.pendingRevision = false;
        this.update({ busy: false, cancellable: false, message: '', revision });
    } }
    changed() { if (this.state.busy)
        this.pendingRevision = true;
    else
        this.update({ revision: this.state.revision + 1 }); }
    setCancel(action: (() => void) | null) { this.cancelAction = action; }
    cancel() { if (this.state.busy && this.state.cancellable)
        this.cancelAction?.(); }
    quarantine() { this.update({ fault: 'Não foi possível confirmar a recuperação. A cópia anterior foi preservada. Reabra Backup e recuperação antes de continuar.' }); }
}
const gates = new WeakMap<object, CatalogGate>();
export function catalogGate(db: object) { let gate = gates.get(db); if (!gate) {
    gate = new CatalogGate();
    gates.set(db, gate);
} return gate; }
export function guardRepository<T extends object>(db: object, repository: T): T { const gate = catalogGate(db), revision = gate.getSnapshot().revision; return Object.fromEntries(Object.entries(repository).map(([name, method]) => [name, (...args: unknown[]) => gate.run(() => { if (revision !== gate.getSnapshot().revision)
        throw Error('O catálogo foi restaurado. Reabra esta tela.'); return method(...args); })])) as T; }
