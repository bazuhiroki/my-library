// /api/sports（vercel.json の rewrites で /api/meter-notion?mode=sports に回す）
// 運動場の記録を Notion「トレーニング」「体重」に残す。
//   GET  ?kind=training|weight  → 新しい順に最大100件
//   POST { kind:'training', type, date, minutes, km, reps, memo, method } → 追加
//   POST { kind:'weight', date, kg, fat, memo } → 追加
const NOTION = 'https://api.notion.com/v1';
const DBS = {
  training: { ds: process.env.TRAINING_DATA_SOURCE_ID || '081244cf-cb40-4641-8bc7-32af22f3b853', db: process.env.TRAINING_DATABASE_ID || '6f3e38b6d42346cfb87edae2d17df427', emoji: '🏃' },
  weight: { ds: process.env.WEIGHT_DATA_SOURCE_ID || '81490177-6737-424f-9323-45ecdbe8c609', db: process.env.WEIGHT_DATABASE_ID || '2e5f5b65c4bf4214833c0ce858be90ef', emoji: '⚖️' },
};
const TYPES = ['ランニング', 'ウォーキング', '筋トレ', 'ストレッチ', 'サイクリング', '水泳', 'その他'];
const H = (v) => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': v, 'Content-Type': 'application/json' });
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');
const rt = (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 1900) } }] : [] });
// 長い文字（GPSのルート）は 1900 文字ずつに分けて入れる（最大 90 個 ≒ 17 万文字）
const rtLong = (s) => { const t = String(s || ''); const parts = []; for (let i = 0; i < t.length && parts.length < 90; i += 1900) parts.push({ text: { content: t.slice(i, i + 1900) } }); return { rich_text: parts }; };
const num = (v) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.round(n * 100) / 100 : null; };
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const okDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? d : today());

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
function fromPage(kind, pg) {
  const p = pg.properties || {};
  if (kind === 'weight') return { id: pg.id, date: p['日付']?.date?.start || '', kg: p['体重（kg）']?.number ?? null, fat: p['体脂肪率（%）']?.number ?? null, memo: txt(p['メモ']) };
  return {
    id: pg.id, title: txt(p['タイトル']), type: p['種目']?.select?.name || '', date: p['日付']?.date?.start || '',
    minutes: p['時間（分）']?.number ?? null, km: p['距離（km）']?.number ?? null, pace: p['ペース（分/km）']?.number ?? null,
    reps: txt(p['回数・セット']), memo: txt(p['メモ']), method: p['記録方法']?.select?.name || '',
    laps: txt(p['ラップ']), route: txt(p['ルート']),
  };
}
function props(kind, b) {
  const date = okDate(b.date);
  if (kind === 'weight') {
    const kg = num(b.kg);
    return {
      'タイトル': { title: [{ text: { content: date + (kg !== null ? '　' + kg + 'kg' : '') } }] },
      '日付': { date: { start: date } }, '体重（kg）': { number: kg }, '体脂肪率（%）': { number: num(b.fat) }, 'メモ': rt(b.memo),
    };
  }
  const type = TYPES.includes(b.type) ? b.type : 'その他';
  const km = num(b.km), minutes = num(b.minutes);
  const pace = km && minutes ? Math.round((minutes / km) * 100) / 100 : null;
  const title = type + (km ? '　' + km + 'km' : '') + (minutes ? '　' + minutes + '分' : '');
  return {
    'タイトル': { title: [{ text: { content: title } }] },
    '種目': { select: { name: type } }, '日付': { date: { start: date } },
    '時間（分）': { number: minutes }, '距離（km）': { number: km }, 'ペース（分/km）': { number: pace },
    '回数・セット': rt(b.reps), 'メモ': rt(b.memo), '記録方法': { select: { name: b.method === 'GPS' ? 'GPS' : '手入力' } },
    'ラップ': rt(b.laps), 'ルート': rtLong(b.route),
  };
}

export async function sports(req, res) {
  try {
    if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})) : {};
    const kind = (req.query.kind || body.kind) === 'weight' ? 'weight' : 'training';
    const D = DBS[kind];
    if (req.method === 'GET') {
      const j = await call((v) => (v === '2025-09-03' ? `${NOTION}/data_sources/${D.ds}/query` : `${NOTION}/databases/${D.db}/query`), 'POST', { page_size: 100, sorts: [{ property: '日付', direction: 'descending' }, { timestamp: 'created_time', direction: 'descending' }] });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ kind, records: j.results.map((pg) => fromPage(kind, pg)) });
    }
    if (req.method === 'POST') {
      if (process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
      if (kind === 'weight' && num(body.kg) === null) return res.status(400).json({ error: '体重を入れてください' });
      const pg = await call(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: D.ds } : { database_id: D.db }, icon: { type: 'emoji', emoji: D.emoji }, properties: props(kind, body) }));
      return res.status(200).json({ kind, record: fromPage(kind, pg) });
    }
    return res.status(405).end();
  } catch (e) { return res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}
