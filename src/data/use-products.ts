import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';
import { createRepository } from './repository';
export function useProducts() {
  const db = useSQLiteContext();
  return useMemo(() => createRepository(db, randomUUID), [db]);
}
