// /api/videos（vercel.json の rewrites で /api/meter-notion?mode=video に回す）
// 映画館で上映した動画を Notion「動画」データベースに残す。ジャンルとタグは Notion の AI エージェントが付ける。
//   GET   ?cursor=        → 一覧（新しい順に100件ずつ）
//   GET   ?probe=<URL>    → リンクから、サービス・題名・チャンネル・サムネイルを調べる
//   POST  { url, title, service, channel, thumb, status } → 追加
//   PATCH { pageId, fields:{ status, rating, note, watched } } → 更新
const NOTION = 'https://api.notion.com/v1';
const DS = process.env.VIDEO_DATA_SOURCE_ID || 'be701eb1-cc5c-49a4-af1a-6aa1b1362bbe';
const DB = process.env.VIDEO_DATABASE_ID || '38023b607b3c4f37b3b2aaf85089902b';
const H = (v) => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': v, 'Content-Type': 'application/json' });
const clip = (s, n) => String(s || '').slice(0, n);
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');
const rt = (s) => ({ rich_text: s ? [{ text: { content: clip(s, 1900) } }] : [] });
const okUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u) && u.length < 1900;
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// リンクの種類を見分ける（埋め込み再生できるものは embed を返す）
export function detect(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (e) { return null; }
  const h = u.hostname.replace(/^www\.|^m\./, '');
  let id = '';
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (h.endsWith('youtube.com') || h === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/\/(shorts|live|embed|v)\/([^/?#]+)/) || [])[2] || '';
  }
  if (id && /^[\w-]{6,15}$/.test(id)) {
    const t = Number(u.searchParams.get('t') || u.searchParams.get('start') || 0) || 0;
    return { service: 'YouTube', id, url: 'https://www.youtube.com/watch?v=' + id, embed: 'https://www.youtube.com/embed/' + id + '?playsinline=1&rel=0&modestbranding=1' + (t ? '&start=' + t : ''), thumb: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' };
  }
  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const v = (u.pathname.match(/(\d{6,})/) || [])[1];
    if (v) return { service: 'Vimeo', id: v, url: 'https://vimeo.com/' + v, embed: 'https://player.vimeo.com/video/' + v + '?playsinline=1', thumb: '' };
  }
  if (h === 'nicovideo.jp' || h === 'nico.ms' || h === 'sp.nicovideo.jp' || h === 'embed.nicovideo.jp') {
    const v = (u.pathname.match(/((?:sm|so|nm)\d+)/) || [])[1];
    if (v) return { service: 'ニコニコ', id: v, url: 'https://www.nicovideo.jp/watch/' + v, embed: 'https://embed.nicovideo.jp/watch/' + v, thumb: '' };
  }
  const service = /amazon\.|primevideo\./.test(h) ? 'Amazonプライム' : /netflix\./.test(h) ? 'Netflix' : /unext\.|video\.unext/.test(h) ? 'U-NEXT' : 'その他';
  return { service, id: '', url: u.href, embed: '', thumb: '' };
}

async function call(url, method, body) {
  for (const v of ['2025-09-03', '2022-06-28']) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url(v), { method, headers: H(v), body: body ? JSON.stringify(typeof body === 'function' ? body(v) : body) : undefined });
      if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1000)); continue; }
      if (r.ok) return r.json();
      if (v === '2025-09-03' && (r.status === 400 || r.status === 404)) break;
      throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
  }
  throw new Error('Notion に接続できませんでした');
}
function fromPage(pg) {
  const p = pg.properties || {};
  const files = p['サムネイル']?.files || [];
  const f = files[0];
  return {
    pageId: pg.id,
    title: txt(p['タイトル']),
    url: p['URL']?.url || '',
    service: p['サービス']?.select?.name || '',
    channel: txt(p['チャンネル']),
    thumb: p['サムネイルURL']?.url || (f ? (f.external?.url || f.file?.url || '') : ''),
    status: p['状態']?.select?.name || '',
    rating: p['評価']?.select?.name || '',
    watched: p['観た日']?.date?.start || '',
    note: txt(p['感想']),
    genre: p['ジャンル']?.select?.name || '',
    tags: (p['タグ']?.multi_select || []).map((x) => x.name),
    created: pg.created_time || '',
  };
}
function props(it, partial) {
  const o = {};
  const has = (k) => !partial || it[k] !== undefined;
  if (has('title')) o['タイトル'] = { title: [{ text: { content: clip(it.title || '(無題)', 1900) } }] };
  if (has('url') && okUrl(it.url)) o['URL'] = { url: it.url };
  if (has('service') && it.service) o['サービス'] = { select: { name: it.service } };
  if (has('channel')) o['チャンネル'] = rt(it.channel);
  if (has('thumb') && okUrl(it.thumb)) { o['サムネイルURL'] = { url: it.thumb }; o['サムネイル'] = { files: [{ name: 'サムネイル', type: 'external', external: { url: it.thumb } }] }; }
  if (has('status')) o['状態'] = it.status ? { select: { name: it.status } } : { select: null };
  if (has('rating')) o['評価'] = it.rating ? { select: { name: it.rating } } : { select: null };
  if (has('note')) o['感想'] = rt(it.note);
  if (has('watched')) o['観た日'] = it.watched ? { date: { start: it.watched === 'today' ? today() : it.watched } } : { date: null };
  if (partial && it.genre) { o['ジャンル'] = { select: { name: it.genre } }; o['ジャンルの判定'] = { select: { name: '手動' } }; }
  return o;
}
// 題名やチャンネル名を、ページの情報（oEmbed / og）から調べる
async function probe(raw) {
  const d = detect(raw);
  if (!d) return { error: 'URL を読み取れませんでした' };
  const out = { ...d, title: '', channel: '' };
  const get = async (u) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000); try { const r = await fetch(u, { signal: c.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyLibrary/1.0)', 'Accept-Language': 'ja' } }); return r.ok ? r : null; } catch (e) { return null; } finally { clearTimeout(t); } };
  try {
    if (d.service === 'YouTube') {
      const r = await get('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(d.url));
      if (r) { const j = await r.json(); out.title = j.title || ''; out.channel = j.author_name || ''; }
    } else if (d.service === 'Vimeo') {
      const r = await get('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(d.url));
      if (r) { const j = await r.json(); out.title = j.title || ''; out.channel = j.author_name || ''; out.thumb = j.thumbnail_url || ''; }
    } else {
      const r = await get(d.url);
      if (r) {
        const html = (await r.text()).slice(0, 300000);
        const meta = (k) => { const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)["\']', 'i')) || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + k + '["\']', 'i')); return m ? m[1] : ''; };
        out.title = meta('og:title') || ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim();
        out.thumb = out.thumb || meta('og:image');
        out.channel = meta('og:site_name');
      }
    }
  } catch (e) { /* 調べられなくても、題名は手で入れられる */ }
  out.title = out.title.replace(/&amp;/g, '&').replace(/&quot;/g, "'").replace(/&#39;/g, "'").trim();
  return out;
}

export async function videos(req, res) {
  try {
    if (req.method === 'GET' && req.query.probe) return res.status(200).json(await probe(req.query.probe));
    if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
    if (req.method !== 'GET' && process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
    if (req.method === 'GET') {
      const cursor = String(req.query.cursor || '') || undefined;
      const j = await call((v) => (v === '2025-09-03' ? `${NOTION}/data_sources/${DS}/query` : `${NOTION}/databases/${DB}/query`), 'POST', { page_size: 100, sorts: [{ timestamp: 'created_time', direction: 'descending' }], ...(cursor ? { start_cursor: cursor } : {}) });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ records: j.results.map(fromPage), next: j.has_more ? j.next_cursor : '' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'POST') {
      const pg = await call(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: DS } : { database_id: DB }, icon: { type: 'emoji', emoji: '🎬' }, properties: props(body, false) }));
      return res.status(200).json({ record: fromPage(pg) });
    }
    if (req.method === 'PATCH') {
      const pg = await call(() => `${NOTION}/pages/${body.pageId}`, 'PATCH', { properties: props(body.fields || {}, true) });
      return res.status(200).json({ record: fromPage(pg) });
    }
    return res.status(405).end();
  } catch (e) { return res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}
