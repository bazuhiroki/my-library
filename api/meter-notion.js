// /api/meter-notion — 読書メーターの本を Notion「読書メーター」に同期する
//   GET   ?cursor=      → Notion にある本を100件ずつ { records, next }
//   POST  { items:[…] } → 新しい本を追加（10冊まで）
//   PATCH { updates:[{ pageId, fields }] } → 本棚やジャンルなどを更新（10件まで）
import { queryPage, createPage, patchPage, fromPage, sleep } from './_meter.js';
import { calil } from './_calil.js';
import { library } from './_library.js';
import { videos } from './_video.js';
import { sports } from './_sports.js';
import { movies } from './_movies.js';
import { mind } from './_mind.js';
import { stones } from './_stones.js';
import { factory } from './_factory.js';

export default async function handler(req, res) {
  // Vercel の無料プランは関数が12個までなので、カーリルの問い合わせもここで受ける
  if (req.query.mode === 'calil') return calil(req, res);
  if (req.query.mode === 'library') return library(req, res);
  if (req.query.mode === 'video') return videos(req, res);
  if (req.query.mode === 'sports') return sports(req, res);
  if (req.query.mode === 'movie') return movies(req, res);
  if (req.query.mode === 'mind') return mind(req, res);
  if (req.query.mode === 'stones') return stones(req, res);
  if (req.query.mode === 'factory') return factory(req, res);
  if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
  if (req.method !== 'GET' && process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
  try {
    if (req.method === 'GET') {
      const j = await queryPage(null, String(req.query.cursor || '') || undefined);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ records: j.results.map(fromPage).filter((r) => r.id), next: j.has_more ? j.next_cursor : '' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'POST') {
      const created = []; let failed = 0;
      for (const it of (body.items || []).slice(0, 10)) {
        try { const pg = await createPage(it); created.push({ id: String(it.id), pageId: pg.id }); } catch (e) { failed++; }
        await sleep(120);
      }
      return res.status(200).json({ created, failed });
    }
    if (req.method === 'PATCH') {
      let ok = 0, failed = 0;
      for (const u of (body.updates || []).slice(0, 10)) {
        try { await patchPage(u.pageId, u.fields || {}); ok++; } catch (e) { failed++; }
        await sleep(120);
      }
      return res.status(200).json({ ok, failed });
    }
    res.status(405).end();
  } catch (e) { res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}
