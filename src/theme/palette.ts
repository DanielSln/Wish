export type AppearancePreference = 'system' | 'light' | 'dark';
export const palettes = {
  light: { bg: '#F7FAFC', card: '#FFFFFF', accent: '#A9D8F4', accentText: '#173C55', primary: '#287BB5', onPrimary: '#FFFFFF', soft: '#EAF4FB', text: '#1D2939', muted: '#526B7D', border: '#D9E5ED', error: '#A62D3E', dangerBg: '#FCE8EC', priorityHigh: '#A43238', priorityMedium: '#875406', priorityLow: '#246444' },
  dark: { bg: '#101A23', card: '#172632', accent: '#A9D8F4', accentText: '#173C55', primary: '#92CDF3', onPrimary: '#102A3C', soft: '#203B4C', text: '#ECF5FA', muted: '#AAC0CE', border: '#324957', error: '#FFB4C1', dangerBg: '#4B2832', priorityHigh: '#FFAAA0', priorityMedium: '#F3C46D', priorityLow: '#91D4AC' },
};
export type Palette = typeof palettes.light;
export function resolveAppearance(preference: AppearancePreference, system: string | null | undefined): 'light' | 'dark' {
  return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
}
