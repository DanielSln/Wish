const dbName = 'wish-local-backup-v1';
async function database() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(dbName, 1); request.onupgradeneeded = () => { for (const name of ['photos', 'files'])
    if (!request.result.objectStoreNames.contains(name))
        request.result.createObjectStore(name); }; request.onerror = () => reject(Error('Não foi possível abrir o armazenamento local de backups.')); request.onsuccess = () => resolve(request.result); }); }
export async function stored<T>(store: 'photos' | 'files', key: string): Promise<T | undefined> { const db = await database(); try {
    return await new Promise((resolve, reject) => { const tx = db.transaction(store, 'readonly'), r = tx.objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(Error('Não foi possível ler o arquivo local.')); });
}
finally {
    db.close();
} }
export async function put(store: 'photos' | 'files', key: string, value: unknown) { const db = await database(); try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, key); tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(Error('Não foi possível salvar o arquivo local.')); });
}
finally {
    db.close();
} }
export async function storedNames() { const db = await database(); try {
    return await new Promise<string[]>((resolve, reject) => { const tx = db.transaction('files', 'readonly'), r = tx.objectStore('files').getAllKeys(); r.onsuccess = () => resolve(r.result.map(String)); r.onerror = () => reject(Error('Não foi possível listar as cópias locais.')); });
}
finally {
    db.close();
} }
export async function removeStored(store: 'photos' | 'files', key: string) { const db = await database(); try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(Error('Não foi possível confirmar a remoção do registro local.')); });
}
finally {
    db.close();
} }
