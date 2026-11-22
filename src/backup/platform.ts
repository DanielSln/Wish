import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { imageManager } from '@/images/manager';
import { localImagePattern, imageExtension, MAX_IMAGE_BYTES } from '@/domain/image-management';
import { backupHash } from './hash';
import { LIMITS, checkCancelled, type Reader, type Writer } from './format';
import type { BackupPlatform, Staged } from './platform.types';
const folder = () => { const d = new Directory(Paths.document, 'wish-local-backups'); d.create({ intermediates: true, idempotent: true }); return d; };
const temporary = () => { const d = new Directory(Paths.cache, 'wish-backup-staging'); d.create({ intermediates: true, idempotent: true }); return d; };
const safetyName = /^wish-before-restore-[a-f0-9-]{36}\.wishbackup$/;
async function space(bytes: number) { const available = Paths.availableDiskSpace; if (Number.isFinite(available) && available >= 0 && available < bytes + 16 * 1024 * 1024)
    throw Error('Espaço insuficiente. Libere espaço antes de continuar.'); }
function reader(file: File): Reader { if (!file.exists || file.size <= 0 || file.size > LIMITS.total)
    throw Error('Arquivo vazio, indisponível ou maior que 128 MB.'); const handle = file.open(FileMode.ReadOnly); return { size: file.size, read: n => handle.readBytes(n), close: () => handle.close() }; }
function writer(file: File): Writer { const handle = file.open(FileMode.Truncate); return { write: bytes => handle.writeBytes(bytes), close: () => handle.close() }; }
function staged(file: File, owned = false): Staged { return { name: file.name, open: async () => reader(file), dispose: async () => { if (owned && file.exists)
        file.delete(); } }; }
async function decode(reference: string, bytes: Uint8Array) { const ext = imageExtension(bytes), file = new File(temporary(), randomUUID() + '.' + ext); try {
    file.create();
    await file.write(bytes);
    const image = await Image.loadAsync(file.uri, { maxWidth: 512, maxHeight: 512 });
    try {
        if (!image.width || !image.height)
            throw Error('Foto inválida.');
    }
    finally {
        image.release();
    }
}
finally {
    if (file.exists)
        file.delete();
} }
const journalFile = () => new File(folder(), 'restore-journal.json');
const journal = { async read() { const f = journalFile(); if (!f.exists)
        return null; if (f.size > 2048)
        throw Error('Registro inválido.'); return JSON.parse(await f.text()); }, async write(value: unknown) { const temp = new File(folder(), randomUUID() + '.tmp'); temp.create(); await temp.write(JSON.stringify(value)); await temp.move(journalFile(), { overwrite: true }); }, async clear() { const f = journalFile(); if (f.exists)
        f.delete(); } };
const files: BackupPlatform['files'] = { openSafety: async (name) => { if (!safetyName.test(name))
        throw Error('Cópia inválida.'); return reader(new File(folder(), name)); }, journal, hash: backupHash, checkSpace: space,
    async readPhoto(ref) { const m = localImagePattern.exec(ref); if (!m)
        throw Error('Referência de foto inválida.'); const f = new File(Paths.document, 'wish-product-images', m[1] + '.' + m[2]); if (!f.exists || f.size < 1 || f.size > MAX_IMAGE_BYTES)
        throw Error('Uma foto local está ausente ou inválida. Nenhum backup completo foi criado.'); return f.bytes(); },
    async installPhoto(ref, bytes) { await decode(ref, bytes); if (await imageManager.persist(bytes) !== ref)
        throw Error('Não foi possível confirmar a foto restaurada.'); },
    decodePhoto: decode,
    async createSafety() { const name = 'wish-before-restore-' + randomUUID() + '.wishbackup', file = new File(folder(), name + '.tmp'), destination = new File(folder(), name); file.create(); return { name, writer: writer(file), reader: async () => reader(file), commit: async () => { await file.move(destination, { overwrite: false }); } }; },
};
export const backupPlatform: BackupPlatform = { files,
    async pick() { const p = await File.pickFileAsync({ mimeTypes: ['*/*'] }); return p.canceled ? null : staged(p.result); },
    async stage(source, op) { const input = await source.open(); let file: File | undefined, out: Writer | undefined; try {
        await space(input.size * 2);
        file = new File(temporary(), randomUUID() + '.wishstage');
        file.create();
        out = writer(file);
        let size = 0;
        while (true) {
            checkCancelled(op);
            const bytes = await input.read(LIMITS.chunk);
            if (!bytes.length)
                break;
            size += bytes.length;
            if (size > LIMITS.total || size > input.size)
                throw Error('Arquivo maior que o limite.');
            await out.write(bytes);
        }
        if (size !== input.size)
            throw Error('Arquivo incompleto.');
        await out.close();
        out = undefined;
        return staged(file, true);
    }
    catch (e) {
        if (out) {
            try {
                await out.close();
            }
            catch { }
            out = undefined;
        }
        if (file?.exists) {
            try {
                file.delete();
            }
            catch { }
        }
        throw e;
    }
    finally {
        try {
            await input.close();
        }
        finally {
            await out?.close();
        }
    } },
    async target() { let directory: Directory; try {
        directory = await Directory.pickDirectoryAsync();
    }
    catch {
        return null;
    } if (directory.uri.startsWith(Paths.document.uri) || directory.uri.startsWith(Paths.cache.uri))
        throw Error('Escolha uma pasta fora do armazenamento privado do Wish.'); let output: File | null = null; const name = 'Wish-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8) + '.wishbackup'; return { name, confirmation: 'Backup salvo e conferido na pasta escolhida.', create: async () => { output = directory.createFile(name, 'application/octet-stream'); return { writer: writer(output), reader: async () => reader(output!) }; }, finish: async () => { }, discard: async () => { if (output?.exists)
            output.delete(); } }; },
    async safetyCopies() { return folder().list().filter(f => f instanceof File && safetyName.test(f.name)).map(f => f.name).reverse(); },
    async safety(name) { if (!safetyName.test(name))
        throw Error('Cópia de segurança inválida.'); return staged(new File(folder(), name)); },
};
