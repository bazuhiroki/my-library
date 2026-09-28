// GET /api/cover?isbn=978... — 表紙画像を同じドメインから配る（3D空間のテクスチャに使うため）
import { normIsbn, coverCandidates, get } from './_isbn.js';
export default async function handler(req, res) {
  const isbn = normIsbn(req.query.isbn);
  if (!isbn) return res.status(400).end();
  const known = typeof req.query.src === 'string' && /^https:\/\/(books\.google|cover\.openbd|ndlsearch\.ndl|books\.googleusercontent)/.test(req.query.src) ? req.query.src : null;
  for (const url of coverCandidates(isbn, known)) {
    const r = await get(url, 4000);
    if (!r) continue;
    const type = r.headers.get('content-type') || '';
    if (!/^image\//.test(type)) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1200) continue; // 「画像なし」の小さなダミーを避ける
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, max-age=604800, immutable');
    return res.status(200).send(buf);
  }
  res.setHeader('Cache-Control', 's-maxage=86400');
  res.status(404).end();
}
