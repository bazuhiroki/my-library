// /api/movies（vercel.json の rewrites で /api/meter-notion?mode=movie に回す）
// 映画博物館の収蔵品を Notion「映画」に集める。作品情報は TMDb（The Movie Database）の公式 API から取る。
// This product uses the TMDB API but is not endorsed or certified by TMDB.
//   GET  ?cursor=                      → 収蔵品の一覧（100件ずつ）
//   GET  ?search=題名                   → TMDb で探す（追加候補）
//   POST { action:'seed', list, page }  → コレクションの1ページ分（最大20本）を集める（新しい作品だけ。1回に最大10本）
//   POST { action:'add', tmdbId }       → 1本を追加
//   POST { action:'refresh', count }    → 配信状況などを、古い順に更新
//   POST { action:'status', pageId, status, score } → 観た・観たい・お気に入り
const NOTION = 'https://api.notion.com/v1';
const DS = process.env.MOVIE_DATA_SOURCE_ID || '4c4ac022-d390-4219-91d0-43b5dd519503';
const DB = process.env.MOVIE_DATABASE_ID || '87ba5f16fb294c978ff741fa0117128c';
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const H = (v) => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': v, 'Content-Type': 'application/json' });
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');
const rt = (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 1900) } }] : [] });
const ms = (arr) => ({ multi_select: [...new Set((arr || []).filter(Boolean).map((n) => String(n).replace(/,/g, '・').slice(0, 90)))].slice(0, 25).map((name) => ({ name })) });
const sleep = (ms2) => new Promise((ok) => setTimeout(ok, ms2));
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// 国の名前（よく出るものだけ日本語にする）
const COUNTRY = { US: 'アメリカ', JP: '日本', GB: 'イギリス', FR: 'フランス', KR: '韓国', DE: 'ドイツ', IT: 'イタリア', ES: 'スペイン', CA: 'カナダ', AU: 'オーストラリア', CN: '中国', HK: '香港', TW: '台湾', IN: 'インド', SE: 'スウェーデン', DK: 'デンマーク', NO: 'ノルウェー', FI: 'フィンランド', NZ: 'ニュージーランド', IE: 'アイルランド', BE: 'ベルギー', NL: 'オランダ', MX: 'メキシコ', BR: 'ブラジル', AR: 'アルゼンチン', RU: 'ロシア', SU: 'ソ連', PL: 'ポーランド', IR: 'イラン', TH: 'タイ', CH: 'スイス', AT: 'オーストリア', CZ: 'チェコ', HU: 'ハンガリー', IL: 'イスラエル', ZA: '南アフリカ', TR: 'トルコ', PT: 'ポルトガル', GR: 'ギリシャ', IS: 'アイスランド' };
// 配信サービスの名前をそろえる
const PROVIDER = (n) => String(n || '').replace(/^Amazon Prime Video.*$/i, 'Prime Video').replace(/^Disney Plus$/i, 'Disney+').replace(/ with Ads$/i, '').replace(/^Netflix basic.*$/i, 'Netflix').trim();

async function tmdb(path, params = {}) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY が未設定です');
  const u = new URL(TMDB + path);
  u.searchParams.set('api_key', key);
  Object.entries({ language: 'ja-JP', ...params }).forEach(([k, v]) => { if (v !== undefined && v !== '') u.searchParams.set(k, v); });
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u.href);
    if (r.status === 429) { await sleep(800); continue; }
    if (!r.ok) throw new Error(`TMDb ${r.status}`);
    return r.json();
  }
  throw new Error('TMDb が混み合っています');
}
async function notion(url, method, body) {
  for (const v of ['2025-09-03', '2022-06-28']) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url(v), { method, headers: H(v), body: body ? JSON.stringify(typeof body === 'function' ? body(v) : body) : undefined });
      if (r.status === 429) { await sleep(1000); continue; }
      if (r.ok) return r.json();
      if (v === '2025-09-03' && (r.status === 400 || r.status === 404)) break;
      throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
  }
  throw new Error('Notion に接続できませんでした');
}
const queryUrl = (v) => (v === '2025-09-03' ? `${NOTION}/data_sources/${DS}/query` : `${NOTION}/databases/${DB}/query`);

// ---- コレクション（博物館の「収集計画」）。list のキーと、TMDb のどの一覧から集めるか
const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const GENRE_IDS = { アクション: 28, アドベンチャー: 12, アニメーション: 16, コメディ: 35, 犯罪: 80, ドキュメンタリー: 99, ドラマ: 18, ファミリー: 10751, ファンタジー: 14, 歴史: 36, ホラー: 27, 音楽: 10402, 謎: 9648, ロマンス: 10749, SF: 878, スリラー: 53, 戦争: 10752, 西部劇: 37 };
const SUBS = { Netflix: 8, 'Prime Video': 9, 'U-NEXT': 84, 'Disney+': 337, Hulu: 15 };
export function collections() {
  const L = [];
  L.push({ key: 'trend', label: '今週の話題作', path: '/trending/movie/week', params: {}, pages: 5 });
  L.push({ key: 'now', label: '上映中', path: '/movie/now_playing', params: { region: 'JP' }, pages: 5 });
  L.push({ key: 'popular', label: '人気作', path: '/movie/popular', params: { region: 'JP' }, pages: 25 });
  L.push({ key: 'top', label: '名作の殿堂', path: '/movie/top_rated', params: {}, pages: 30 });
  [1930, 1940].forEach((d) => L.push({ key: 'decade' + d, label: d + '年代の名作', path: '/discover/movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 150, 'primary_release_date.gte': d + '-01-01', 'primary_release_date.lte': (d + 9) + '-12-31' }, pages: 3 }));
  DECADES.forEach((d) => L.push({ key: 'decade' + d, label: d + '年代の名作', path: '/discover/movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': d < 1980 ? 200 : 500, 'primary_release_date.gte': d + '-01-01', 'primary_release_date.lte': (d + 9) + '-12-31' }, pages: 8 }));
  DECADES.forEach((d) => L.push({ key: 'hit' + d, label: d + '年代のヒット作', path: '/discover/movie', params: { sort_by: 'vote_count.desc', 'primary_release_date.gte': d + '-01-01', 'primary_release_date.lte': (d + 9) + '-12-31' }, pages: 5 }));
  L.push({ key: 'jp', label: '日本映画の名作', path: '/discover/movie', params: { with_original_language: 'ja', sort_by: 'vote_average.desc', 'vote_count.gte': 80 }, pages: 15 });
  L.push({ key: 'jppop', label: '日本映画の人気作', path: '/discover/movie', params: { with_original_language: 'ja', sort_by: 'popularity.desc' }, pages: 20 });
  L.push({ key: 'anime', label: 'アニメ映画', path: '/discover/movie', params: { with_original_language: 'ja', with_genres: 16, sort_by: 'vote_count.desc' }, pages: 10 });
  [['ko', '韓国映画'], ['fr', 'フランス映画'], ['zh', '中国語圏の映画'], ['it', 'イタリア映画'], ['es', 'スペイン語の映画'], ['de', 'ドイツ映画'], ['hi', 'インド映画']].forEach(([lang, label]) => L.push({ key: 'lang' + lang, label, path: '/discover/movie', params: { with_original_language: lang, sort_by: 'vote_count.desc' }, pages: 5 }));
  Object.entries(SUBS).forEach(([n, id]) => L.push({ key: 'sub' + id, label: n + 'で観られる作品', path: '/discover/movie', params: { watch_region: 'JP', with_watch_providers: id, with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc' }, pages: 20 }));
  Object.entries(GENRE_IDS).forEach(([n, id]) => L.push({ key: 'g' + id, label: n + 'の名作', path: '/discover/movie', params: { with_genres: id, sort_by: 'vote_average.desc', 'vote_count.gte': 300 }, pages: 6 }));
  return L;
}
// ---- 最新作（毎日の取り込み）：日本の公開作（前後の期間）・上映中・公開予定・各サブスクの新着
function latestLists() {
  const day = (n) => new Date(Date.now() + 9 * 3600 * 1000 + n * 86400000).toISOString().slice(0, 10);
  const L = [
    { label: '最新作', path: '/discover/movie', params: { region: 'JP', 'release_date.gte': day(-120), 'release_date.lte': day(150), sort_by: 'popularity.desc' }, pages: 30 },
    { label: '最新作', path: '/movie/now_playing', params: { region: 'JP' }, pages: 10 },
    { label: '最新作', path: '/movie/upcoming', params: { region: 'JP' }, pages: 10 },
    { label: '最新作', path: '/discover/movie', params: { 'primary_release_date.gte': day(-120), 'primary_release_date.lte': day(30), sort_by: 'popularity.desc', 'vote_count.gte': 5 }, pages: 15 },
  ];
  Object.entries(SUBS).forEach(([n, id]) => L.push({ label: '最新作', path: '/discover/movie', params: { watch_region: 'JP', with_watch_providers: id, with_watch_monetization_types: 'flatrate', 'primary_release_date.gte': day(-365), sort_by: 'primary_release_date.desc' }, pages: 5 }));
  return L;
}
// まとめて詳しい情報を取る（5本ずつ並べて取る）
async function details(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 5) {
    const part = await Promise.all(ids.slice(i, i + 5).map((id) => detail(id).catch(() => null)));
    out.push(...part.filter(Boolean));
  }
  return out;
}
// 新しい作品を作る（Notion は1本ずつ）
async function createMany(ms2, label, deadline) {
  const added = [];
  for (const d of ms2) {
    if (Date.now() > deadline) break;
    try { const pg = await createPage(d, [label]); added.push(fromPage(pg)); } catch (e) { /* 続ける */ }
    await sleep(120);
  }
  return added;
}
let createPage = null; // movies() / ingestLatest() の中で用意する
// 最新作の取り込み（cron と、アプリの「最新作を取り込む」から呼ぶ）。時間の上限まで続ける
export async function ingestLatest(budgetMs) {
  const deadline = Date.now() + (budgetMs || 40000);
  createPage = createFn();
  let added = [], checked = 0, done = true;
  outer: for (const c of latestLists()) {
    for (let p = 1; p <= c.pages; p++) {
      if (Date.now() > deadline - 4000) { done = false; break outer; }
      let j;
      try { j = await tmdb(c.path, { ...c.params, page: p }); } catch (e) { break; }
      const res = (j.results || []).filter((m) => m.poster_path);
      checked += res.length;
      if (res.length) {
        const have = await existing(res.map((m) => m.id));
        const fresh = res.filter((m) => !have.has(m.id));
        if (fresh.length) added = added.concat(await createMany(await details(fresh.map((m) => m.id)), c.label, deadline - 2000));
      }
      if (!j.total_pages || p >= j.total_pages) break;
    }
  }
  return { added, checked, done };
}
function createFn() {
  return (m, coll) => notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: DS } : { database_id: DB }, icon: { type: 'emoji', emoji: '🎞️' }, properties: props(m, coll) }));
}

// ---- TMDb の作品 → Notion のページの中身
async function detail(id) {
  const d = await tmdb('/movie/' + id, { append_to_response: 'credits,videos,watch/providers', include_video_language: 'ja,en' });
  const year = d.release_date ? Number(d.release_date.slice(0, 4)) : null;
  const decade = !year ? '' : year < 1950 ? 'それ以前' : Math.floor(year / 10) * 10 + '年代';
  const crew = (d.credits && d.credits.crew) || [];
  const directors = crew.filter((c) => c.job === 'Director').map((c) => c.name);
  const cast = ((d.credits && d.credits.cast) || []).slice(0, 8).map((c) => c.name);
  const jp = (d['watch/providers'] && d['watch/providers'].results && d['watch/providers'].results.JP) || {};
  const vids = ((d.videos && d.videos.results) || []).filter((v) => v.site === 'YouTube');
  const tr = vids.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'ja') || vids.find((v) => v.type === 'Trailer') || vids.find((v) => v.type === 'Teaser') || null;
  return {
    id: d.id, title: d.title || d.original_title, original: d.original_title, year, decade, date: d.release_date || '',
    runtime: d.runtime || null, countries: (d.production_countries || []).map((c) => COUNTRY[c.iso_3166_1] || c.name),
    genres: (d.genres || []).map((g) => g.name), directors, cast, overview: (d.overview || '').slice(0, 600),
    poster: d.poster_path ? IMG + 'w342' + d.poster_path : '', backdrop: d.backdrop_path ? IMG + 'w780' + d.backdrop_path : '',
    trailer: tr ? 'https://www.youtube.com/watch?v=' + tr.key : '', vote: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    popularity: d.popularity ? Math.round(d.popularity) : null,
    flatrate: (jp.flatrate || []).map((p) => PROVIDER(p.provider_name)), rent: [...(jp.rent || []), ...(jp.buy || [])].map((p) => PROVIDER(p.provider_name)), link: jp.link || '',
  };
}
function props(m, coll) {
  const o = {
    'タイトル': { title: [{ text: { content: String(m.title || '(無題)').slice(0, 1900) } }] },
    '原題': rt(m.original !== m.title ? m.original : ''), 'TMDb ID': { number: m.id }, '公開年': { number: m.year },
    '公開日': m.date ? { date: { start: m.date } } : { date: null }, '上映時間': { number: m.runtime },
    '製作国': ms(m.countries), 'ジャンル': ms(m.genres), '監督': rt(m.directors.join('、')), 'キャスト': rt(m.cast.join('、')),
    'あらすじ': rt(m.overview), 'ポスターURL': { url: m.poster || null }, '背景URL': { url: m.backdrop || null }, '予告編': { url: m.trailer || null },
    'TMDb評価': { number: m.vote }, '人気度': { number: m.popularity }, '見放題': ms(m.flatrate), 'レンタル・購入': ms(m.rent),
    '配信ページ': { url: m.link || null }, '最終更新': { date: { start: today() } },
  };
  if (m.decade) o['年代'] = { select: { name: m.decade } };
  if (m.poster) o['ポスター'] = { files: [{ name: 'ポスター', type: 'external', external: { url: m.poster } }] };
  if (coll) o['コレクション'] = ms(coll);
  return o;
}
function fromPage(pg) {
  const p = pg.properties || {};
  const names = (k) => (p[k]?.multi_select || []).map((x) => x.name);
  return {
    pageId: pg.id, id: p['TMDb ID']?.number || null, title: txt(p['タイトル']), original: txt(p['原題']), year: p['公開年']?.number || null,
    decade: p['年代']?.select?.name || '', runtime: p['上映時間']?.number || null, countries: names('製作国'), genres: names('ジャンル'),
    directors: txt(p['監督']).split('、').filter(Boolean), cast: txt(p['キャスト']).split('、').filter(Boolean), overview: txt(p['あらすじ']).slice(0, 400), date: p['公開日']?.date?.start || '',
    poster: p['ポスターURL']?.url || '', backdrop: p['背景URL']?.url || '', trailer: p['予告編']?.url || '', vote: p['TMDb評価']?.number ?? null,
    popularity: p['人気度']?.number ?? null, flatrate: names('見放題'), rent: names('レンタル・購入'), link: p['配信ページ']?.url || '',
    status: p['状態']?.select?.name || '', score: p['私のスコア']?.number ?? null, collections: names('コレクション'), updated: p['最終更新']?.date?.start || '',
  };
}
// TMDb ID で、すでに収蔵しているものを探す
async function existing(ids) {
  if (!ids.length) return new Map();
  const filter = { or: ids.map((id) => ({ property: 'TMDb ID', number: { equals: id } })) };
  const j = await notion(queryUrl, 'POST', { page_size: 100, filter });
  return new Map(j.results.map((pg) => [pg.properties['TMDb ID']?.number, pg]));
}

export async function movies(req, res) {
  try {
    if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
    if (req.method === 'GET') {
      if (req.query.search) {
        const j = await tmdb('/search/movie', { query: String(req.query.search).slice(0, 80) });
        return res.status(200).json({ results: (j.results || []).slice(0, 12).map((m) => ({ id: m.id, title: m.title, year: (m.release_date || '').slice(0, 4), poster: m.poster_path ? IMG + 'w185' + m.poster_path : '' })) });
      }
      if (req.query.plan) return res.status(200).json({ collections: collections().map(({ key, label, pages }) => ({ key, label, pages })) });
      const cursor = String(req.query.cursor || '') || undefined;
      const j = await notion(queryUrl, 'POST', { page_size: 100, sorts: [{ property: '人気度', direction: 'descending' }], ...(cursor ? { start_cursor: cursor } : {}) });
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
      return res.status(200).json({ records: j.results.map(fromPage), next: j.has_more ? j.next_cursor : '' });
    }
    if (req.method !== 'POST') return res.status(405).end();
    if (process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const create = async (m, coll) => notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: DS } : { database_id: DB }, icon: { type: 'emoji', emoji: '🎞️' }, properties: props(m, coll) }));

    if (b.action === 'seed') {
      const c = collections().find((x) => x.key === b.list);
      if (!c) return res.status(400).json({ error: '収集計画にない一覧です' });
      const page = Math.max(1, Math.min(c.pages, Number(b.page) || 1));
      if (b.page > c.pages) return res.status(200).json({ added: [], more: false, tagged: 0 });
      const j = await tmdb(c.path, { ...c.params, page });
      const list = (j.results || []).filter((m) => m.poster_path).slice(0, 20);
      const have = await existing(list.map((m) => m.id));
      const fresh = list.filter((m) => !have.has(m.id));
      createPage = create;
      const added = await createMany(await details(fresh.slice(0, 20).map((m) => m.id)), c.label, Date.now() + 45000);
      // すでにある作品には、コレクション名だけ足す（多すぎると遅いので5本まで）
      let tagged = 0;
      for (const pg of [...have.values()].slice(0, 5)) {
        const cur = (pg.properties['コレクション']?.multi_select || []).map((x) => x.name);
        if (cur.includes(c.label)) continue;
        try { await notion(() => `${NOTION}/pages/${pg.id}`, 'PATCH', { properties: { 'コレクション': ms([...cur, c.label]) } }); tagged++; } catch (e) { /* 続ける */ }
      }
      return res.status(200).json({ added, more: fresh.length > added.length && added.length > 0, tagged, total: j.total_pages || 0 });
    }
    if (b.action === 'latest') { const r = await ingestLatest(45000); return res.status(200).json(r); }
    if (b.action === 'add') {
      const id = Number(b.tmdbId);
      const have = await existing([id]);
      if (have.has(id)) return res.status(200).json({ record: fromPage(have.get(id)), existed: true });
      const pg = await create(await detail(id), ['自分で加えた作品']);
      return res.status(200).json({ record: fromPage(pg) });
    }
    if (b.action === 'refresh') {
      // 最終更新の古い順に、配信状況・評価・人気度を更新する
      const j = await notion(queryUrl, 'POST', { page_size: Math.min(25, Number(b.count) || 20), sorts: [{ property: '最終更新', direction: 'ascending' }] });
      let ok = 0;
      for (const pg of j.results) {
        const id = pg.properties['TMDb ID']?.number; if (!id) continue;
        try {
          const d = await detail(id);
          await notion(() => `${NOTION}/pages/${pg.id}`, 'PATCH', { properties: { '見放題': ms(d.flatrate), 'レンタル・購入': ms(d.rent), '配信ページ': { url: d.link || null }, 'TMDb評価': { number: d.vote }, '人気度': { number: d.popularity }, '予告編': { url: d.trailer || null }, '最終更新': { date: { start: today() } } } });
          ok++;
        } catch (e) { /* 続ける */ }
        await sleep(120);
      }
      return res.status(200).json({ refreshed: ok });
    }
    if (b.action === 'status') {
      const o = { '状態': b.status ? { select: { name: b.status } } : { select: null } };
      if (b.score !== undefined) o['私のスコア'] = { number: b.score === '' || b.score === null ? null : Number(b.score) };
      const pg = await notion(() => `${NOTION}/pages/${b.pageId}`, 'PATCH', { properties: o });
      return res.status(200).json({ record: fromPage(pg) });
    }
    return res.status(400).json({ error: 'action が不明です' });
  } catch (e) { return res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}
