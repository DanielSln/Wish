import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { palettes, resolveAppearance, type AppearancePreference } from './palette';
const ThemeContext = createContext({ colors: palettes.light, mode: 'light' as 'light' | 'dark', preference: 'system' as AppearancePreference, setPreference: async (_: AppearancePreference) => {}, error: '' });
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [preference, setValue] = useState<AppearancePreference>('system');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key='appearance'").then(row => {
      if (alive && row && ['system', 'light', 'dark'].includes(row.value)) setValue(row.value as AppearancePreference);
    }).catch(() => { if (alive) setError('Não foi possível carregar a aparência salva.'); }).finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [db]);
  async function setPreference(next: AppearancePreference) {
    if (!ready) throw new Error('Aguarde o carregamento da aparência.');
    await db.runAsync("INSERT INTO app_settings(key,value) VALUES ('appearance',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", next);
    setValue(next); setError('');
  }
  const mode = resolveAppearance(preference, system);
  return <ThemeContext.Provider value={{ colors: palettes[mode], mode, preference, setPreference, error }}>{children}</ThemeContext.Provider>;
}
export const useAppearance = () => useContext(ThemeContext);
