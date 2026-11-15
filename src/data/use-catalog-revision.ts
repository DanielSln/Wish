import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { localStore } from './store';
// Refresh visible read-only screens after remote changes without resetting an open form.
export function useCatalogRevision() {
  const db = useSQLiteContext();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = localStore(db).subscribe(reason => {
      if (reason === 'settings') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setRevision(value => value + 1), 120);
    });
    return () => { unsubscribe(); if (timer) clearTimeout(timer); };
  }, [db]);
  return revision;
}
