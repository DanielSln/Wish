import { randomUUID } from 'expo-crypto';
import { backupHash } from './hash';
import { stored, put, removeStored, storedNames } from './web-storage';
import { imageExtension, localImagePattern } from '@/domain/image-management';
import { LIMITS, type Reader, type Writer } from './format';
import type { BackupPlatform, Staged } from './platform.types';
function reader(blob: Blob): Reader { let offset = 0; return { size: blob.size, read: async (n) => { const bytes = new Uint8Array(await blob.slice(offset, offset + n).arrayBuffer()); offset += bytes.length; return bytes; }, close: () => { } }; }
function writer(done: (blob: Blob) => Promise<void>): Writer { const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0; return { write: async (bytes) => { size += bytes.length; if (size > LIMITS.total)
        throw Error('Backup maior que 128 MB.'); chunks.push(new Uint8Array(bytes)); }, close: async () => { await done(new Blob(chunks, { type: 'application/octet-stream' })); } }; }
async function space(bytes: number) { if (navigator.storage?.estimate) {
    const s = await navigator.storage.estimate();
    if (typeof s.quota === 'number' && typeof s.usage === 'number' && s.quota - s.usage < bytes + 16 * 1024 * 1024)
        throw Error('Espaço insuficiente no armazenamento do navegador.');
} }
const stage = (blob: Blob, name: string): Staged => ({ name, open: async () => reader(blob), dispose: async () => { } });
async function decode(ref: string, bytes: Uint8Array) { imageExtension(bytes); const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)])); try {
    if (!bitmap.width || !bitmap.height)
        throw Error('Foto inválida.');
}
finally {
    bitmap.close();
} }
export const backupPlatform: BackupPlatform = { files: { openSafety: async (name) => { if (!/^wish-before-restore-[a-f0-9-]{36}\.wishbackup$/.test(name))
            throw Error('Cópia inválida.'); const blob = await stored<Blob>('files', name); if (!blob)
            throw Error('Cópia ausente.'); return reader(blob); }, journal: { read: async () => await stored('files', 'restore-journal') ?? null, write: async (v) => { await put('files', 'restore-journal', v); }, clear: async () => { await removeStored('files', 'restore-journal'); } }, hash: backupHash, checkSpace: space,
        async readPhoto(ref) { const bytes = await stored<Uint8Array>('photos', ref); if (!bytes)
            throw Error('Uma foto local está ausente neste navegador.'); return new Uint8Array(bytes); },
        async installPhoto(ref, bytes) { if (!localImagePattern.test(ref))
            throw Error('Referência inválida.'); await decode(ref, bytes); await put('photos', ref, new Uint8Array(bytes)); }, decodePhoto: decode,
        async createSafety() { const name = 'wish-before-restore-' + randomUUID() + '.wishbackup'; let blob: Blob | null = null, committed = false; return { name, writer: writer(async (b) => { blob = b; }), reader: async () => { const saved = committed ? await stored<Blob>('files', name) : blob; if (!saved)
                throw Error('Cópia anterior não encontrada.'); return reader(saved); }, commit: async () => { if (!blob)
                throw Error('Cópia ausente.'); await put('files', name, blob); committed = true; } }; }, },
    async pick() { return new Promise<Staged | null>((resolve) => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.wishbackup,application/octet-stream'; input.onchange = () => { const file = input.files?.[0]; resolve(file ? stage(file, file.name) : null); }; input.oncancel = () => resolve(null); input.click(); }); },
    async stage(source) { return source; },
    async target() { let blob: Blob | null = null; const name = 'Wish-' + new Date().toISOString().replace(/[:.]/g, '-') + '.wishbackup'; return { name, confirmation: 'Arquivo verificado. Download solicitado; confirme o salvamento no navegador.', create: async () => ({ writer: writer(async (value) => { blob = value; }), reader: async () => { if (!blob)
                throw Error('Arquivo não concluído.'); return reader(blob); } }), finish: async () => { if (!blob)
            throw Error('Arquivo ausente.'); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }, discard: async () => { blob = null; } }; },
    async safetyCopies() { return (await storedNames()).filter(n => /^wish-before-restore-[a-f0-9-]{36}\.wishbackup$/.test(n)).reverse(); },
    async safety(name) { if (!/^wish-before-restore-[a-f0-9-]{36}\.wishbackup$/.test(name))
        throw Error('Cópia inválida.'); const blob = await stored<Blob>('files', name); if (!blob)
        throw Error('Cópia não encontrada.'); return stage(blob, name); },
};
