import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, useUI } from '@/components/ui';
import { backupPlatform as platform } from '@/backup/platform';
import { useMaintenance } from '@/backup/use-maintenance';
import { readBackup, summary, type Manifest, type Catalog } from '@/backup/format';
import { withReader, exportCatalog, restoreFromStaged } from '@/backup/service';
import type { Staged } from '@/backup/platform.types';
export default function BackupScreen() {
    const { db, gate, state } = useMaintenance(), { styles, colors } = useUI();
    const [pending, setPending] = useState(false), [preview, setPreview] = useState<{
        source: Staged;
        manifest: Manifest;
        catalog: Catalog;
    } | null>(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [copies, setCopies] = useState<string[]>([]);
    const controller = useRef<AbortController | null>(null), lock = useRef(false), alive = useRef(true), held = useRef<Staged | null>(null);
    useEffect(() => { alive.current = true; platform.safetyCopies().then(v => { if (alive.current)
        setCopies(v); }).catch(() => { if (alive.current)
        setError('Não foi possível listar as cópias anteriores.'); }); return () => { alive.current = false; controller.current?.abort(); gate.setCancel(null); void held.current?.dispose(); }; }, [gate]);
    const op = () => { const c = new AbortController(); controller.current = c; gate.setCancel(() => c.abort()); return { signal: c.signal, progress: (message: string) => gate.update({ message }) }; };
    function failure(e: unknown) { if (alive.current)
        setError(e instanceof Error && !/sqlite|SQLITE|^Error|^Failed|^Could|^TypeError|^Unknown|^Unable/.test(e.message) ? e.message : 'Não foi possível concluir. Nenhuma operação foi confirmada; verifique a cópia de segurança.'); }
    async function inspect(local?: string) { if (lock.current || state.busy)
        return; lock.current = true; setPending(true); setError(''); setMessage(''); gate.update({ result: '' }); let source: Staged | null = null; try {
        const selected = local ? await platform.safety(local) : await platform.pick();
        if (!selected) {
            setMessage('Nenhum arquivo selecionado. Seus dados não foram alterados.');
            return;
        }
        const options = op();
        await gate.exclusive('Lendo e verificando arquivo…', async () => { source = await platform.stage(selected, options); return withReader(await source.open(), async (reader) => { const checked = await readBackup(reader, platform.files.hash, platform.files.decodePhoto, options); if (!alive.current)
            return; await held.current?.dispose(); held.current = source; setPreview({ source: source!, ...checked }); source = null; }); });
    }
    catch (e) {
        failure(e);
    }
    finally {
        await (source as Staged | null)?.dispose();
        lock.current = false;
        if (alive.current)
            setPending(false);
    } }
    async function exportFile() { if (lock.current || state.busy)
        return; lock.current = true; setPending(true); setError(''); setMessage(''); gate.update({ result: '' }); let target: Awaited<ReturnType<typeof platform.target>> = null; try {
        target = await platform.target();
        if (!target) {
            setMessage('Salvamento cancelado. Nenhum backup foi confirmado.');
            return;
        }
        await exportCatalog(db, platform.files, target.create, op());
        await target.finish();
        if (alive.current)
            setMessage(target.confirmation + ' Guarde uma cópia fora do aparelho.');
    }
    catch (e) {
        try {
            await target?.discard();
        }
        catch { /* Only the newly-created incomplete output may remain. */ }
        failure(e);
    }
    finally {
        lock.current = false;
        if (alive.current)
            setPending(false);
    } }
    async function restore() { if (!preview || lock.current || state.busy)
        return; lock.current = true; setPending(true); setError(''); try {
        await restoreFromStaged(db, platform.files, preview.source.open, op(), preview.manifest);
    }
    catch (e) {
        failure(e);
    }
    finally {
        lock.current = false;
        if (alive.current) {
            setPending(false);
            platform.safetyCopies().then(setCopies).catch(() => { });
        }
    } }
    async function cancelPreview() { await held.current?.dispose(); held.current = null; setPreview(null); setError(''); setMessage('Restauração cancelada. Seus dados não foram alterados.'); }
    const counts = preview ? summary(preview.catalog) : null;
    return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: 12, gap: 14 }]}>
 <Text style={styles.heading}>Seus dados, com você</Text><Text style={styles.body}>Inclui desejos, comprados, categorias, fotos locais, ofertas, notas e aparência. Imagens remotas são preservadas como links, sem baixar as fotos.</Text><Text style={[styles.body, { color: colors.text }]}>O arquivo não tem criptografia e contém dados pessoais legíveis. Guarde-o em um local seguro, fora do Wish; para troca ou perda do aparelho, mantenha também uma cópia em outro lugar.</Text>
 {!!(message || state.result) && <Text accessibilityLiveRegion="polite" style={styles.body}>{message || state.result}</Text>}{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 {preview && counts ? <View style={{ gap: 12, paddingVertical: 8 }}><Text style={styles.heading}>Confira antes de restaurar</Text><Text style={styles.body}>Backup de {new Date(preview.manifest.createdAt).toLocaleString('pt-BR')} · formato 1 · SQLite v5</Text><Text style={styles.body}>{counts.pending} desejos · {counts.purchased} comprados · {counts.categories} categorias · {counts.offers} ofertas · {counts.photos} fotos locais</Text><Text style={styles.body}>Aparência: {counts.appearance === 'system' ? 'Automática' : counts.appearance === 'dark' ? 'Escura' : 'Clara'}. Registros excluídos preservados: {counts.deleted}.</Text><Text style={[styles.body, { color: colors.error }]}>Esta restauração substituirá todo o catálogo e a aparência atuais. Edições não salvas serão descartadas. Uma cópia anterior completa será criada antes da substituição; não há mesclagem automática.</Text><Button title="Confirmar substituição e restaurar" disabled={pending || state.busy} onPress={() => { void restore(); }}/><Button title="Cancelar restauração" variant="secondary" disabled={pending || state.busy} onPress={() => { void cancelPreview(); }}/></View> : <><Button title={pending ? 'Aguarde…' : 'Exportar backup'} disabled={pending || state.busy || !!state.fault} onPress={() => { void exportFile(); }}/><Button title="Restaurar backup" variant="secondary" disabled={pending || state.busy} onPress={() => { void inspect(); }}/></>}
 {!!copies.length && !preview && <View style={{ gap: 8 }}><Text style={styles.heading}>Cópias anteriores</Text><Text style={styles.body}>Criadas antes de restaurar. Estas cópias ficam no Wish e não sobrevivem à desinstalação. Selecione para validar e confirmar; nada será restaurado automaticamente.</Text>{copies.map((name, i) => <Button key={name} title={'Inspecionar cópia anterior ' + (i + 1)} variant="secondary" disabled={pending || state.busy} onPress={() => { void inspect(name); }}/>)}</View>}
 <Text style={[styles.body, { fontSize: 12 }]}>Formato .wishbackup · até 128 MB, 512 fotos e 8 MB por foto. Nenhum serviço de nuvem ou login é necessário. A criação do arquivo não confirma que ele foi copiado para outro aparelho.</Text>
 </ScrollView>;
}
