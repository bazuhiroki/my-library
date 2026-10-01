// ウェブページの <meta> を読むための小さな道具（正規表現のエスケープを使わずに書いている）
const DQ = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const blank = (c) => c === undefined || c.trim() === '';

export function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, DQ).replace(/&apos;/g, SQ).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .trim();
}
function parseAttrs(s) {
  const o = {};
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && (blank(s[i]) || s[i] === '/')) i++;
    let k = '';
    while (i < n && s[i] !== '=' && !blank(s[i]) && s[i] !== '/' && s[i] !== '>') { k += s[i]; i++; }
    while (i < n && blank(s[i])) i++;
    let v = '';
    if (s[i] === '=') {
      i++;
      while (i < n && blank(s[i])) i++;
      const q = s[i];
      if (q === DQ || q === SQ) {
        const e = s.indexOf(q, i + 1);
        v = s.slice(i + 1, e < 0 ? n : e);
        i = e < 0 ? n : e + 1;
      } else {
        while (i < n && !blank(s[i]) && s[i] !== '>') { v += s[i]; i++; }
      }
    }
    if (k) o[k.toLowerCase()] = v; else i++;
  }
  return o;
}
// name / property ごとに content を集める（同じ名前が複数あれば全部）
export function metas(html) {
  const out = {};
  const low = html.toLowerCase();
  let p = 0;
  for (;;) {
    const a = low.indexOf('<meta', p);
    if (a < 0) break;
    const b = html.indexOf('>', a);
    if (b < 0) break;
    const at = parseAttrs(html.slice(a + 5, b));
    const key = (at.name || at.property || at.itemprop || '').toLowerCase();
    if (key && at.content !== undefined) (out[key] = out[key] || []).push(decode(at.content));
    p = b + 1;
  }
  const t0 = low.indexOf('<title');
  if (t0 >= 0) {
    const t1 = html.indexOf('>', t0);
    const t2 = low.indexOf('</title>', t1);
    if (t1 > 0 && t2 > t1) out['<title>'] = [decode(html.slice(t1 + 1, t2))];
  }
  return out;
}
export const first = (m, ...keys) => { for (const k of keys) { const v = m[k]; if (v && v[0]) return v[0]; } return ''; };

// 取得元が内部のネットワークでないかを確かめる
export function publicUrl(u) {
  let x;
  try { x = new URL(u); } catch (e) { return null; }
  if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
  const h = x.hostname.toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.startsWith('[')) return null;
  const parts = h.split('.');
  if (parts.length === 4 && parts.every((d) => d !== '' && String(Number(d)) === d)) {
    const [a, b] = parts.map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127)) return null;
  }
  return x;
}
const UA = 'Mozilla/5.0 (compatible; MyLibrary/1.0; personal reading app)';
export async function fetchPage(u, ms = 6000, max = 1500000) {
  const x = publicUrl(u);
  if (!x) return null;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(x.href, { signal: c.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.5', 'Accept-Language': 'ja,en;q=0.8' } });
    if (!r.ok) return { status: r.status, url: r.url || x.href, type: '', text: '' };
    if (!publicUrl(r.url || x.href)) return null;
    const type = (r.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('html') && !type.includes('xml')) return { status: r.status, url: r.url || x.href, type, text: '' };
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf.byteLength > max ? buf.slice(0, max) : buf);
    let text = new TextDecoder('utf-8').decode(bytes);
    const cs = (type.split('charset=')[1] || '').trim() || (text.slice(0, 3000).toLowerCase().split('charset=')[1] || '').replace(/[^a-z0-9_-].*$/, '');
    if (cs && !cs.startsWith('utf')) { try { text = new TextDecoder(cs).decode(bytes); } catch (e) { /* utf-8 のまま */ } }
    return { status: r.status, url: r.url || x.href, type, text };
  } catch (e) { return null; } finally { clearTimeout(t); }
}
export async function fetchJson(u, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(u, { signal: c.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } }); return r.ok ? await r.json() : null; }
  catch (e) { return null; } finally { clearTimeout(t); }
}
export async function fetchText(u, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(u, { signal: c.signal, headers: { 'User-Agent': UA } }); return r.ok ? await r.text() : ''; }
  catch (e) { return ''; } finally { clearTimeout(t); }
}
