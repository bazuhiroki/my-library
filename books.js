// GET /api/books — Notion の文学賞DB＋公式発表の最新受賞作を返す
import { readNotion, readOfficialLatest, missing } from './_lib.js';

export default async function handler(req, res) {
  let rows = [], source = 'none', error = null;
  try { const n = await readNotion(); if (n) { rows = n; source = 'notion'; } } catch (e) { error = String(e.message || e).slice(0, 300); }
  let latest = [];
  try { latest = await readOfficialLatest(); } catch (_) {}
  const extra = missing(latest, rows);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json({ source, count: rows.length, rows: rows.concat(extra), latest, error });
}
