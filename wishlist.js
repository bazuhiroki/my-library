// /api/wishlist — Notion「読書管理」（読みたい本リスト）の読み書き
//   GET    一覧      POST {isbn,title,authors,publisher,description,cover}  追加（同じISBNは追加しない）
//   PATCH  {id,status}  読書ステータスを変更      DELETE ?id=  ゴミ箱へ
const NOTION = 'https://api.notion.com/v1';
const DS = process.env.WISHLIST_DATA_SOURCE_ID || '28efba1c-4ef1-80f1-bff7-000bb2c82653';
const DB = process.env.WISHLIST_DATABASE_ID || '28efba1c4ef1805bb2aae5b91ba8cdc6';
const H = (v) => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': v, 'Content-Type': 'application/json' });
const PUBLISHERS = ['講談社', '集英社', 'KADOKAWA', '小学館', '新潮社', '岩波書店', '文藝春秋', '光文社'];
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');
const clip = (s, n) => (s || '').slice(0, n);

async function query(filter) {
  const out = []; let cursor; let mode = 'ds';
  for (let i = 0; i < 20; i++) {
    const body = JSON.stringify({ page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) });
    const r = mode === 'ds'
      ? await fetch(`${NOTION}/data_sources/${DS}/query`, { method: 'POST', headers: H('2025-09-03'), body })
      : await fetch(`${NOTION}/databases/${DB}/query`, { method: 'POST', headers: H('2022-06-28'), body });
    if (!r.ok && mode === 'ds' && i === 0) { mode = 'db'; i--; continue; }
    if (!r.ok) throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json(); out.push(...j.results); if (!j.has_more) break; cursor = j.next_cursor;
  }
  return out;
}
const toItem = (pg) => {
  const p = pg.properties || {};
  return {
    id: pg.id, title: txt(p['タイトル']), authors: (p['著者']?.multi_select || []).map((x) => x.name),
    isbn: txt(p['ISBN']).replace(/[^0-9X]/g, ''), publisher: p['出版社']?.select?.name || '', cover: p['書影URL']?.url || '',
    status: p['読書ステータス']?.select?.name || '未読', library: txt(p['図書館状況']), created: pg.created_time,
  };
};
async function patchPage(id, body) {
  let r = await fetch(`${NOTION}/pages/${id}`, { method: 'PATCH', headers: H('2025-09-03'), body: JSON.stringify(body) });
  if (!r.ok) r = await fetch(`${NOTION}/pages/${id}`, { method: 'PATCH', headers: H('2022-06-28'), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Notion ${r.status}`);
}

export default async function handler(req, res) {
  if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
  if (req.method !== 'GET' && process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
  try {
    if (req.method === 'GET') {
      const items = (await query()).map(toItem).filter((x) => x.title);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'POST') {
      const isbn = (body.isbn || '').replace(/[^0-9X]/g, '');
      if (isbn) { const dup = await query({ property: 'ISBN', rich_text: { equals: isbn } }); if (dup.length) return res.status(200).json({ item: toItem(dup[0]), duplicate: true }); }
      const pub = PUBLISHERS.find((p) => (body.publisher || '').includes(p)) || (body.publisher ? 'その他' : null);
      const props = {
        タイトル: { title: [{ text: { content: clip(body.title, 1900) } }] },
        ISBN: { rich_text: [{ text: { content: isbn } }] },
        著者: { multi_select: (body.authors || []).slice(0, 5).map((a) => ({ name: clip(a.replace(/,/g, ' '), 90) })) },
        読書ステータス: { select: { name: '未読' } },
        最終確認日時: { date: { start: new Date().toISOString().slice(0, 10) } },
        ...(pub ? { 出版社: { select: { name: pub } } } : {}),
        ...(body.cover ? { 書影URL: { url: body.cover } } : {}),
        ...(body.description ? { 概要: { rich_text: [{ text: { content: clip((pub === 'その他' ? `【${body.publisher}】` : '') + body.description, 1900) } }] } } : (pub === 'その他' ? { 概要: { rich_text: [{ text: { content: `【${body.publisher}】` } }] } } : {})),
      };
      let r = await fetch(`${NOTION}/pages`, { method: 'POST', headers: H('2025-09-03'), body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: DS }, icon: { type: 'emoji', emoji: '📕' }, properties: props }) });
      if (!r.ok) r = await fetch(`${NOTION}/pages`, { method: 'POST', headers: H('2022-06-28'), body: JSON.stringify({ parent: { database_id: DB }, properties: props }) });
      if (!r.ok) throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return res.status(200).json({ item: toItem(await r.json()) });
    }
    if (req.method === 'PATCH') {
      await patchPage(body.id, { properties: { 読書ステータス: { select: { name: body.status } }, ...(body.status === '読了' ? { 読了日: { date: { start: new Date().toISOString().slice(0, 10) } } } : {}) } });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await patchPage(req.query.id, { in_trash: true });
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) { res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}
