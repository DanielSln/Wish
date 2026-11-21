// Text recognition is independent of permission to make a network request.
export const MAX_SHARED_TEXT = 16384;
export function sharedLinks(value: string): string[] {
  if (value.length > MAX_SHARED_TEXT) return [];
  const links: string[] = [];
  for (const match of value.matchAll(/https?:\/\/[^\s<>"“”]+/gi)) {
    let candidate = match[0];
    if (!/[?#]/.test(candidate) || /[)\]}][.,;]+$/.test(candidate)) candidate = candidate.replace(/[.,;]+$/, '');
    // Remove only unmatched wrapping punctuation; balanced URL parentheses survive.
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (candidate.endsWith(close) && candidate.split(close).length > candidate.split(open).length) candidate = candidate.slice(0,-1);
    }
    try {
      const url = new URL(candidate);
      if (!links.includes(url.href)) links.push(url.href);
    } catch { /* An incomplete pasted URL is not a candidate. */ }
  }
  return links.slice(0, 20);
}
export function originalImportUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Informe um link HTTPS válido da loja.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !host.includes('.') || ['.local','.localhost','.internal','.lan','.home'].some(suffix => host.endsWith(suffix)) || host === 'localhost.localdomain' ||
      host.includes(':') || /^[\d.]+$/.test(host)) throw new Error('Use um link HTTPS público da loja, sem credenciais ou endereço de rede local.');
  if (url.href.length > 8192) throw new Error('O link deve ter até 8192 caracteres.');
  url.hostname = host;
  return url.href;
}

// Only a known explicit Google URL wrapper is decoded locally. No Google page or
// open redirect is fetched. Unsupported Shopping wrappers remain manual-only.
export function consultationImportUrl(value: string): string {
  let current = originalImportUrl(value);
  for (let hop = 0; hop < 3; hop++) {
    const url = new URL(current);
    if (!['google.com','www.google.com','google.com.br','www.google.com.br'].includes(url.hostname) || url.pathname !== '/url') break;
    const destinations = [...new Set([url.searchParams.get('url'),url.searchParams.get('q')].filter((v): v is string => !!v))];
    if (destinations.length !== 1) break;
    current = originalImportUrl(destinations[0]);
  }
  const url = new URL(current); url.hash = ''; return url.href;
}
