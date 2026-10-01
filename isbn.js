// GET /api/isbn?isbn=978... — 書誌情報を返す
import { normIsbn, lookup } from './_isbn.js';
export default async function handler(req, res) {
  const isbn = normIsbn(req.query.isbn);
  if (!isbn) return res.status(400).json({ error: 'ISBN の形になっていません' });
  const info = await lookup(isbn);
  if (!info) return res.status(404).json({ isbn, error: 'この ISBN の本が見つかりませんでした' });
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400');
  res.status(200).json(info);
}
