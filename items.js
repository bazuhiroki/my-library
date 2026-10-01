// /api/items?kind=paper|magazine — Notion「論文」「雑誌」の読み書き
//   GET 一覧   POST 追加（同じURLは追加しない）   PATCH {id, status?, rating?, note?, finished?, field?}   DELETE ?id=
const NOTION = 'https://api.notion.com/v1';
const KINDS = {
  paper: {
    ds: process.env.PAPERS_DATA_SOURCE_ID || '71de0d07-090e-4d46-b683-3989217e8054',
    db: process.env.PAPERS_DATABASE_ID || 'f2c1a187cde9428ea55a52e94b14fbe1',
    icon: '📜',
  },
  magazine: {
    ds: process.env.MAGAZINES_DATA_SOURCE_ID || 'e458c91b-397c-426d-81a1-30f77cb6aa87',
    db: process.env.MAGAZINES_DATABASE_ID || 'f536e3d1550f466c8c30fc1c5f9fa821',
    icon: '📰',
  },
};
const FIELDS = ['AI/技術', '経営/経済', '社会科学', '自然科学', '人文', 'その他'];
const H = (v) => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': v, 'Content-Type': 'application/json' });
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');
const clip = (s, n) => String(s || '').slice(0, n);
const rt = (s, n) => ({ rich_text: s ? [{ text: { content: clip(s, n || 1900) } }] : [] });
const jstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const okUrl = (u) => typeof u === 'string' && (u.startsWith('https://') || u.startsWith('http://')) && u.length < 1900;

async function query(K, filter) {
  const out = []; let cursor; let mode = 'ds';
  for (let i = 0; i < 20; i++) {
    const body = JSON.stringify({ page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) });
    const r = mode === 'ds'
      ? await fetch(`${NOTION}/data_sources/${K.ds}/query`, { method: 'POST', headers: H('2025-09-03'), body })
      : await fetch(`${NOTION}/databases/${K.db}/query`, { method: 'POST', headers: H('2022-06-28'), body });
    if (!r.ok && mode === 'ds' && i === 0) { mode = 'db'; i--; continue; }
    if (!r.ok) throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json(); out.push(...j.results); if (!j.has_more) break; cursor = j.next_cursor;
  }
  return out;
}
function toItem(kind, pg) {
  const p = pg.properties || {};
  const base = {
    id: pg.id, kind, title: txt(p['タイトル']), url: p['URL']?.url || '',
    status: p['読書ステータス']?.select?.name || '未読', rating: p['評価']?.number || 0, note: txt(p['メモ']),
    finished: p['読了日']?.date?.start || '', created: pg.created_time,
  };
  if (kind === 'paper') {
    return { ...base, authors: txt(p['著者']), year: p['年']?.number || 0, journal: txt(p['掲載誌']), pdf: p['PDF']?.url || '', doi: txt(p['DOI']), field: p['分野']?.select?.name || '' };
  }
  const f = (p['表紙画像']?.files || [])[0];
  const uploaded = f ? (f.file?.url || f.external?.url || '') : '';
  return { ...base, magazine: txt(p['雑誌名']), cover: uploaded || p['表紙URL']?.url || '', coverUrl: p['表紙URL']?.url || '', uploaded: !!uploaded, date: p['発行日']?.date?.start || '' };
}
function props(kind, b, isNew) {
  const o = {};
  if (b.title !== undefined) o['タイトル'] = { title: [{ text: { content: clip(b.title || '(無題)', 1900) } }] };
  if (b.url !== undefined && (okUrl(b.url) || b.url === '')) o['URL'] = { url: b.url || null };
  if (b.status) o['読書ステータス'] = { select: { name: b.status } };
  if (b.rating !== undefined) o['評価'] = { number: b.rating ? Number(b.rating) : null };
  if (b.note !== undefined) o['メモ'] = rt(b.note);
  if (b.finished !== undefined) o['読了日'] = { date: b.finished ? { start: b.finished } : null };
  else if (b.status === '読了' && !isNew) o['読了日'] = { date: { start: jstToday() } };
  if (kind === 'paper') {
    if (b.authors !== undefined) o['著者'] = rt(b.authors);
    if (b.year !== undefined) o['年'] = { number: b.year ? Number(b.year) : null };
    if (b.journal !== undefined) o['掲載誌'] = rt(b.journal);
    if (b.pdf !== undefined && (okUrl(b.pdf) || b.pdf === '')) o['PDF'] = { url: b.pdf || null };
    if (b.doi !== undefined) o['DOI'] = rt(b.doi, 200);
    if (b.field !== undefined) o['分野'] = { select: FIELDS.includes(b.field) ? { name: b.field } : null };
  } else {
    if (b.magazine !== undefined) o['雑誌名'] = rt(b.magazine, 200);
    if (b.cover !== undefined && (okUrl(b.cover) || b.cover === '')) o['表紙URL'] = { url: b.cover || null };
    if (b.date !== undefined) o['発行日'] = { date: b.date ? { start: String(b.date).slice(0, 10) } : null };
  }
  return o;
}
// 画像を Notion にアップロードして「表紙画像」に付ける（image: {name, type, data(base64)}）
async function attachImage(pageId, image) {
  const type = String(image.type || 'image/jpeg');
  if (!type.startsWith('image/')) throw new Error('画像ではありません');
  const bytes = Buffer.from(String(image.data || ''), 'base64');
  if (!bytes.length || bytes.length > 4500000) throw new Error('画像が大きすぎます');
  const name = clip(image.name || 'cover.jpg', 90);
  const c = await fetch(`${NOTION}/file_uploads`, { method: 'POST', headers: H('2022-06-28'), body: JSON.stringify({ filename: name, content_type: type }) });
  if (!c.ok) throw new Error(`Notion upload ${c.status}: ${(await c.text()).slice(0, 200)}`);
  const up = await c.json();
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const sent = await fetch(up.upload_url || `${NOTION}/file_uploads/${up.id}/send`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }, body: form });
  if (!sent.ok) throw new Error(`Notion send ${sent.status}: ${(await sent.text()).slice(0, 200)}`);
  return patchPage(pageId, { properties: { 表紙画像: { files: [{ type: 'file_upload', file_upload: { id: up.id }, name }] } } });
}
async function patchPage(id, body) {
  let r = await fetch(`${NOTION}/pages/${id}`, { method: 'PATCH', headers: H('2025-09-03'), body: JSON.stringify(body) });
  if (!r.ok) r = await fetch(`${NOTION}/pages/${id}`, { method: 'PATCH', headers: H('2022-06-28'), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export default async function handler(req, res) {
  const kind = String(req.query.kind || '');
  const K = KINDS[kind];
  if (!K) return res.status(400).json({ error: 'kind は paper か magazine' });
  if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
  if (req.method !== 'GET' && process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
  try {
    if (req.method === 'GET') {
      const items = (await query(K)).map((pg) => toItem(kind, pg)).filter((x) => x.title);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'POST') {
      if (okUrl(body.url)) {
        const dup = await query(K, { property: 'URL', url: { equals: body.url } });
        if (dup.length) return res.status(200).json({ item: toItem(kind, dup[0]), duplicate: true });
      }
      const pr = props(kind, { status: '未読', ...body }, true);
      let r = await fetch(`${NOTION}/pages`, { method: 'POST', headers: H('2025-09-03'), body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: K.ds }, icon: { type: 'emoji', emoji: K.icon }, properties: pr }) });
      if (!r.ok) r = await fetch(`${NOTION}/pages`, { method: 'POST', headers: H('2022-06-28'), body: JSON.stringify({ parent: { database_id: K.db }, properties: pr }) });
      if (!r.ok) throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
      let pg = await r.json();
      if (kind === 'magazine' && body.image && body.image.data) { try { pg = await attachImage(pg.id, body.image); } catch (e) { /* 画像だけ付けられなくても登録は残す */ } }
      return res.status(200).json({ item: toItem(kind, pg) });
    }
    if (req.method === 'PATCH') {
      const { id, image, clearImage, ...rest } = body;
      if (!id) return res.status(400).json({ error: 'id が必要です' });
      const pr = props(kind, rest, false);
      if (kind === 'magazine' && clearImage) pr['表紙画像'] = { files: [] };
      let pg = await patchPage(id, { properties: pr });
      if (kind === 'magazine' && image && image.data) pg = await attachImage(id, image);
      return res.status(200).json({ item: toItem(kind, pg) });
    }
    if (req.method === 'DELETE') {
      await patchPage(req.query.id, { in_trash: true });
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) { res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}
