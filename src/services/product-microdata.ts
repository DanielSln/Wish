// Bounded, inert HTML microdata reader. Never executes scripts or fetches itemid/itemref.
type Row = Record<string, unknown>;
type Frame = { tag: string; scope?: Row; property: string[]; text: string; value?: string };
const attrs = (s: string) => {
  const result: Record<string, string> = Object.create(null);
  for (const m of s.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) result[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return result;
};
function assign(row: Row, key: string, value: unknown) {
  if (['__proto__','prototype','constructor'].includes(key)) return;
  const old = row[key]; row[key] = old === undefined ? value : Array.isArray(old) ? [...old, value] : [old, value];
}
export function microdataProducts(html: string): Row[] {
  const source = html.slice(0, 2000000).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const stack: Frame[] = []; const products: Row[] = []; let count = 0;
  const owner = () => [...stack].reverse().find(frame => frame.scope)?.scope;
  function close() {
    const frame = stack.pop(); if (!frame) return;
    const parent = owner();
    const value = frame.scope ?? frame.value ?? frame.text.trim();
    if (parent) for (const key of frame.property) assign(parent, key, value);
    if (!frame.scope && stack.length) stack[stack.length-1].text = (stack[stack.length-1].text + ' ' + frame.text).slice(0,10000);
  }
  // Scan tags once, honoring quotes; malformed/oversized tags fail closed.
  for (let position = 0; position < source.length;) {
    if (++count > 30000) return [];
    const start = position; let token: string;
    if (source[position] !== '<') {
      const end = source.indexOf('<', position); position = end < 0 ? source.length : end;
      token = source.slice(start, position);
    } else {
      let quote = ''; position++;
      while (position < source.length) {
        const char = source[position++];
        if (quote) { if (char === quote) quote = ''; }
        else if (char === '"' || char === "'") quote = char;
        else if (char === '>') break;
        if (position - start > 16384) return [];
      }
      if (source[position-1] !== '>' || quote) return [];
      token = source.slice(start, position);
    }
    if (!token.startsWith('<')) { if (stack.length) stack[stack.length-1].text = (stack[stack.length-1].text + token).slice(0, 10000); continue; }
    const end = /^<\/\s*([\w:-]+)/.exec(token);
    if (end) { const index = stack.map(f => f.tag).lastIndexOf(end[1].toLowerCase()); if (index >= 0) while (stack.length > index) close(); continue; }
    const tag = /^<\s*([\w:-]+)/.exec(token)?.[1]?.toLowerCase(); if (!tag) continue;
    if (stack.length >= 64) return [];
    const a = attrs(token); const scope = Object.hasOwn(a, 'itemscope') ? { '@type': (a.itemtype ?? '').split(/\s+/).map(v => v.replace(/^https?:\/\/schema.org\//, '')), ...(a.itemid ? { '@id': a.itemid } : {}) } : undefined;
    if (scope && (scope['@type'] as string[]).includes('Product')) { if (products.length >= 100) return []; products.push(scope); }
    const frame: Frame = { tag, scope, property: (a.itemprop ?? '').split(/\s+/).filter(Boolean), text: '', value: a.content ?? (['a','link'].includes(tag) ? a.href : ['img','source'].includes(tag) ? a.src : tag === 'time' ? a.datetime : undefined) };
    stack.push(frame);
    if (/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) || /\/\s*>$/.test(token)) close();
  }
  while (stack.length) close();
  return products;
}
