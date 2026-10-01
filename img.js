// GET /api/img?u=<画像URL> — 雑誌の表紙などを同じドメインから配る（3Dのテクスチャに使うため）
import { publicUrl } from './_html.js';
export default async function handler(req, res) {
  const x = publicUrl(String(req.query.u || ''));
  if (!x) return res.status(400).end();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 6000);
  try {
    const r = await fetch(x.href, { signal: c.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyLibrary/1.0)', Accept: 'image/*' } });
    if (!r.ok || !publicUrl(r.url || x.href)) return res.status(404).end();
    const type = r.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return res.status(415).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 6000000) return res.status(413).end();
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, max-age=604800');
    return res.status(200).send(buf);
  } catch (e) { return res.status(504).end(); } finally { clearTimeout(t); }
}
