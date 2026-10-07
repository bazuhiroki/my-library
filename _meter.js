// 読書メーターの本棚を Notion「読書メーター」データベースに読み書きするための道具
// （/api/meter-notion と /api/cron-meter で共有）
export const NOTION = 'https://api.notion.com/v1';
export const DS = process.env.METER_DATA_SOURCE_ID || 'd0c6443d-33a0-4df9-ab72-884e9febfe78';
export const DB = process.env.METER_DATABASE_ID || '48cb326c4b45483e80164026bc2ed40a';
export const SHELF = { wish: '読みたい本', stacked: '積読本', reading: '読んでる本', read: '読んだ本' };
export const SRC = { rule: 'ルール', ai: 'AI', manual: '手動' };
export const SRC_BACK = { ルール: 'rule', AI: 'ai', 手動: 'manual' };
export const H = (v) => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': v, 'Content-Type': 'application/json' });
const clip = (s, n) => String(s || '').slice(0, n);
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');
const rt = (s) => ({ rich_text: s ? [{ text: { content: clip(s, 1900) } }] : [] });
const okUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u) && u.length < 1900;
export const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// アプリの本1冊 → Notion のプロパティ
export function props(it, partial) {
  const o = {};
  const has = (k) => !partial || it[k] !== undefined;
  if (has('title')) o['タイトル'] = { title: [{ text: { content: clip(it.title || '(無題)', 1900) } }] };
  if (has('author')) o['著者'] = rt(it.author);
  if (has('shelf') && SHELF[it.shelf]) o['本棚'] = { select: { name: SHELF[it.shelf] } };
  if (has('id')) o['読書メーターID'] = rt(String(it.id));
  if (has('url') && okUrl(it.url)) o['読書メーターURL'] = { url: it.url };
  if (has('cover') && okUrl(it.cover)) {
    o['表紙URL'] = { url: it.cover };
    // ギャラリー表示で表紙を並べられるよう、ファイル＆メディアにも外部画像として入れる
    o['表紙'] = { files: [{ name: '表紙', type: 'external', external: { url: it.cover } }] };
  }
  if (has('regs') && Number.isFinite(Number(it.regs))) o['登録者数'] = { number: Number(it.regs) };
  if (has('genre') && it.genre) o['ジャンル'] = { select: { name: it.genre } };
  if (has('tags')) o['タグ'] = { multi_select: (it.tags || []).slice(0, 5).map((n) => ({ name: clip(String(n).replace(/[,，]/g, ' ').trim(), 40) })).filter((x) => x.name) };
  if (has('src') && SRC[it.src]) o['ジャンルの判定'] = { select: { name: SRC[it.src] } };
  if (has('lib')) o['図書館'] = it.lib ? { select: { name: it.lib } } : { select: null };
  if (partial && it.acq !== undefined) o['入手'] = it.acq ? { select: { name: it.acq } } : { select: null };
  if (it.isbn) o['ISBN'] = rt(String(it.isbn));
  if (!partial) o['最終同期'] = { date: { start: today() } };
  return o;
}
export function fromPage(pg) {
  const p = pg.properties || {};
  return {
    pageId: pg.id,
    id: txt(p['読書メーターID']),
    shelf: p['本棚']?.select?.name || '',
    genre: p['ジャンル']?.select?.name || '',
    src: SRC_BACK[p['ジャンルの判定']?.select?.name] || '',
    tags: (p['タグ']?.multi_select || []).map((x) => x.name),
    priority: p['優先度']?.select?.name || '',
    memo: txt(p['メモ']),
    hasCover: (p['表紙']?.files || []).length > 0,
    acq: p['入手']?.select?.name || '',
  };
}
async function call(url, method, body, versions) {
  for (const v of versions) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url(v), { method, headers: H(v), body: body ? JSON.stringify(typeof body === 'function' ? body(v) : body) : undefined });
      if (r.status === 429) { await sleep((Number(r.headers.get('retry-after')) || 1) * 1000); continue; }
      if (r.ok) return r.json();
      if (v === versions[0] && versions.length > 1 && (r.status === 400 || r.status === 404)) break; // 古い版の呼び方で試す
      throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
  }
  throw new Error('Notion に接続できませんでした');
}
export const queryPage = (filter, cursor) => call(
  (v) => v === '2025-09-03' ? `${NOTION}/data_sources/${DS}/query` : `${NOTION}/databases/${DB}/query`, 'POST',
  { page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) }, ['2025-09-03', '2022-06-28']);
export const createPage = (it) => call(
  () => `${NOTION}/pages`, 'POST',
  (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: DS } : { database_id: DB }, icon: { type: 'emoji', emoji: '📗' }, properties: props(it, false) }), ['2025-09-03', '2022-06-28']);
export const patchPage = (pageId, it) => call(
  () => `${NOTION}/pages/${pageId}`, 'PATCH', { properties: props(it, true) }, ['2025-09-03', '2022-06-28']);
export { sleep };
