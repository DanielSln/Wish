import { useSyncExternalStore } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { catalogGate } from '@/data/catalog-gate';
export function useMaintenance() { const db = useSQLiteContext(), gate = catalogGate(db), state = useSyncExternalStore(gate.subscribe, gate.getSnapshot, gate.getSnapshot); return { db, gate, state }; }
