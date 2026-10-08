// /api/mind（vercel.json の rewrites で /api/meter-notion?mode=mind に回す）
// 「心の部屋」：湖のほとりの庵で、エルフと出来事をリフレーミングする。
//   GET  ?diary=1     → Notion「感情日記」の最近の記録（過去の日記を見直すため）
//   GET  ?history=1   → Notion「心の部屋」の最近の記録
//   POST { action:'ai', phase:'listen'|'views'|'talk'|'close', ... } → エルフの返事（JSON）
//   POST { action:'save', record } → Notion「心の部屋」に保存（感情日記とつなぐ）
// AI は GEMINI_API_KEY があれば Gemini、なければ ANTHROPIC_API_KEY があれば Claude を使う。
const NOTION = 'https://api.notion.com/v1';
const MIND = { ds: process.env.MIND_DATA_SOURCE_ID || 'a95bbaa3-812c-4d5a-b767-8bb73d5137c0', db: process.env.MIND_DATABASE_ID || 'b859e220b868486cab2931de5c5510ac' };
const DIARY = { ds: process.env.DIARY_DATA_SOURCE_ID || 'b6ade8b3-02d2-4008-ae28-06c79a1100f3', db: process.env.DIARY_DATABASE_ID || 'e0d6d57e746b4f71be705723568f97c3' };
const H = (v) => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': v, 'Content-Type': 'application/json' });
const txt = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join('');
const rt = (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 1900) } }] : [] });
const rtLong = (s) => { const t = String(s || ''); const parts = []; for (let i = 0; i < t.length && parts.length < 90; i += 1900) parts.push({ text: { content: t.slice(i, i + 1900) } }); return { rich_text: parts }; };
const ms = (arr) => ({ multi_select: [...new Set((arr || []).filter(Boolean).map((n) => String(n).replace(/,/g, '・').slice(0, 90)))].slice(0, 20).map((name) => ({ name })) });
const sleep = (n) => new Promise((ok) => setTimeout(ok, n));
const JOURNAL = { ds: process.env.JOURNAL_DATA_SOURCE_ID || 'e1827f3e-1fa0-4ded-91ea-8a3f02349ad1', db: process.env.JOURNAL_DATABASE_ID || '49fc72b207134c54a1052514d5a6ab43' };
// 感情日記の選択肢（ない言葉は書かない：日記の選択肢を増やさないため）
const DIARY_EMO = ['楽しい', '怒り', '悲しい', '嬉しい', '疲れた', 'どうしたものか', '少し', 'がんばる(前に向かって進むと同義）', '落ち込む', 'ほめられたい', 'なにをしてるんだか', 'なんかほっとする', '休む', 'なるほど', 'やりすぎに注意', '悔しい', 'モヤっと', '嫌だなー', '面白い', 'ちょっと怒り', 'やるぞ！', '気になる！', '怖い', 'めんどくさい', '暑い'];
const DIARY_RES = ['楽しさ×2', '希望', '希望が湧いた', '嬉しさ倍増', '新しい楽しさを見いだせた喜び', '落ち込みが減った', 'やる気×2', '安心感×2', '要注意(ストレスかかっている）×２', '疲れていることに気づけた', 'ストレスサイン◎', 'よし！！わかった！', '面白い×2', '不安が減った', 'スッゴいがんばる！', '頭の整理ができた', '勇気が生まれた', 'ラッキー', 'やることが明確になった'];
const THEMES = ['対人関係', '自己理解', '体調・環境', '仕事・学習', '生活・趣味', '将来・不安'];
const CONDITIONS = ['時間を変える', '相手の位置に立つ', '第三者の位置', '事実と解釈を分ける', '体と環境', '大切にしている価値', '未来の自分', '過去の自分'];
const jst = (d) => new Date(new Date(d || Date.now()).getTime() + 9 * 3600 * 1000);
const jstDate = (d) => jst(d).toISOString().slice(0, 10);
const nowJst = () => jst().toISOString().replace('Z', '+09:00').replace(/\.\d+\+/, '+');

// ---- 費用の上限：Notion「AI利用量」に月ごとの使用量を記録し、上限を超えそうなら AI を呼ばない
// 月の上限は500円。為替や見積もりのずれに備えて、450円で止める（MIND_BUDGET_YEN で変更可）。
const USAGE = { ds: process.env.USAGE_DATA_SOURCE_ID || 'f9fd52fd-f5a5-42e8-b5e9-95ebbbcbc24f', db: process.env.USAGE_DATABASE_ID || 'e4c0e0f6877c459fa4e8df80c56de045' };
const BUDGET_YEN = Math.min(1000, Number(process.env.MIND_BUDGET_YEN) || 950); // エルフと工場長の合算
const YEN_PER_USD = Number(process.env.YEN_PER_USD) || 170; // 実際より高めに見積もる
const PRICE = { // 1M トークンあたりのドル（出力には思考トークンも含む）
  'gemini-2.5-flash': [0.30, 2.50], 'gemini-2.5-flash-lite': [0.10, 0.40],
  'claude-haiku-4-5-20251001': [1.00, 5.00],
};
const MAX_OUT = 700; // 1回の返事の上限トークン
// エルフの声（ElevenLabs）。無料プラン（月1万クレジット）の内側で止める。有料プランにしたときは料金も予算に足す
const VOICE = {
  key: process.env.ELEVENLABS_API_KEY || '',
  voice: process.env.ELEVEN_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  model: process.env.ELEVEN_MODEL || 'eleven_v3',
  cap: Math.min(Number(process.env.ELEVEN_CHAR_CAP) || 9000, 1e6),
  paid: process.env.ELEVEN_PLAN === 'paid',
};
const ttsYen = (chars, model) => (VOICE.paid ? (chars / 1000) * (/flash|turbo/.test(model) ? 0.05 : 0.10) * YEN_PER_USD : 0);
const monthKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
const yenOf = (model, inTok, outTok) => { const p = PRICE[model] || [3, 15]; return ((inTok * p[0] + outTok * p[1]) / 1e6) * YEN_PER_USD; };
async function usageRow() {
  const j = await notion(q(USAGE), 'POST', { page_size: 1, filter: { property: '月', title: { equals: monthKey() } } });
  const pg = j.results[0];
  if (!pg) return { pageId: '', voiceChars: 0, calls: 0, inTok: 0, outTok: 0, yen: 0 };
  const p = pg.properties || {};
  return { pageId: pg.id, voiceChars: p['音声の文字数']?.number || 0, calls: p['呼び出し回数']?.number || 0, inTok: p['入力トークン']?.number || 0, outTok: p['出力トークン']?.number || 0, yen: p['推定費用（円）']?.number || 0 };
}
async function addVoice(row, chars, yenAdd) {
  const props = { '音声の文字数': { number: (row.voiceChars || 0) + chars }, '推定費用（円）': { number: Math.round((row.yen + yenAdd) * 1000) / 1000 }, '上限（円）': { number: BUDGET_YEN }, '最終更新': { date: { start: new Date().toISOString() } } };
  if (row.pageId) await notion(() => `${NOTION}/pages/${row.pageId}`, 'PATCH', { properties: props });
  else await notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: USAGE.ds } : { database_id: USAGE.db }, properties: { '月': { title: [{ text: { content: monthKey() } }] }, '呼び出し回数': { number: 0 }, '入力トークン': { number: 0 }, '出力トークン': { number: 0 }, ...props } }));
}
async function addUsage(row, model, inTok, outTok) {
  const yen = Math.round((row.yen + yenOf(model, inTok, outTok)) * 1000) / 1000;
  const props = { '呼び出し回数': { number: row.calls + 1 }, '入力トークン': { number: row.inTok + inTok }, '出力トークン': { number: row.outTok + outTok }, '推定費用（円）': { number: yen }, '上限（円）': { number: BUDGET_YEN }, '最終更新': { date: { start: new Date().toISOString() } } };
  if (row.pageId) await notion(() => `${NOTION}/pages/${row.pageId}`, 'PATCH', { properties: props });
  else await notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: USAGE.ds } : { database_id: USAGE.db }, properties: { '月': { title: [{ text: { content: monthKey() } }] }, ...props } }));
  return yen;
}

// ---- 命に関わる言葉が出たら、リフレーミングはせず、相談先を伝える
const CRISIS = /(死にたい|しにたい|消えたい|きえたい|自殺|じさつ|自傷|リスカ|首を吊|飛び降り|生きていたくない|生きている意味がない|殺したい|ころしたい|いなくなりたい|終わりにしたい)/;
const CRISIS_REPLY = {
  crisis: true,
  reply: 'それほどつらい気持ちを、ここで言葉にしてくれてありがとう。いまは見方を変えるより、あなたの安全がいちばん大切です。どうか、ひとりで抱えずに、人の声がある場所につながってください。',
  resources: [
    { name: '#いのちSOS', tel: '0120-061-338', note: '24時間・無料' },
    { name: 'よりそいホットライン', tel: '0120-279-338', note: '24時間・無料' },
    { name: 'いのちの電話', tel: '0570-783-556', note: '10時〜22時' },
    { name: 'こころの健康相談統一ダイヤル', tel: '0570-064-556', note: '地域の公的窓口につながります' },
    { name: '命の危険が差し迫っているとき', tel: '119', note: '救急' },
  ],
};

// ---- エルフ（AI）への指示：利用者の「知的探求に関する基本公理」に沿う
const SYSTEM = `あなたは「My Library」という3Dの世界の、湖のほとりの庵に住むエルフです。訪れた人（利用者本人）と、出来事のリフレーミングを一緒に行います。日本語で、やわらかく、落ち着いた丁寧語で話します。1回の発言は短く（200字程度まで）。

【この部屋の考え方（利用者がつくった公理）】
- 等価交換原理：ある現象Aを第三者の視点で観察すると、状態B↑と、同じ情報を反対の性質で持つ反状態C↓が必ず見つかる。
- 相対性原理：正しさは観測条件の下でだけ成り立つ。観測条件を変えれば、同じ出来事の見え方が変わる。唯一の正解は出さない。
- 事実と解釈を分ける：事実の領域は有限、解釈の領域は無限。解釈の正しさは、共有された観測条件の下でだけ成り立つ。
- 思考は拡散（解釈を広げる）と凝縮（理解して絞る）の二つ。対話ではまず広げ、最後に本人が凝縮する。
- 量子論・相対性理論は、この構造を表す比喩として扱う。物理の説明として断言しない。

【リフレーミングの進め方】
- まず感情を受け止める。感情そのものを否定したり、無理に前向きにしたりしない。
- 反状態Cは「別の観測条件から見ると、同じAはこう見える」という形で示す。押しつけず、選ぶのは本人。
- 観測条件の例：時間を変える／相手の位置に立つ／第三者の位置／事実と解釈を分ける／体と環境／大切にしている価値／未来の自分／過去の自分。
- 診断や病名の推測はしない。医療や専門家の代わりにはならない。
- 命に関わる気持ち（死にたい、自分を傷つけたい、誰かを傷つけたい）が見えたら、リフレーミングをやめ、安全を最優先にして相談先につながるよう促す。

【出力】
指示されたJSONの形だけを返す。前置きやコードブロックは付けない。`;

// ---- 本人の自己取扱説明書（Notion のページ）。前提として持っておくが、何でもこれで答えない
const PROFILE_PAGE = process.env.ELF_PROFILE_PAGE_ID || '3f0fba1c-4ef1-8125-a388-c4127e149c3b';
let profileCache = { text: '', at: 0 };
async function blockText(id, depth) {
  const lines = []; let cursor;
  do {
    const r = await fetch(`${NOTION}/blocks/${id}/children?page_size=100${cursor ? '&start_cursor=' + cursor : ''}`, { headers: H('2022-06-28') });
    if (!r.ok) throw new Error('Notion ' + r.status);
    const j = await r.json();
    for (const bl of j.results) {
      const v = bl[bl.type] || {};
      const t = (v.rich_text || []).map((x) => x.plain_text).join('');
      if (t) lines.push((bl.type.startsWith('heading') ? '■' : bl.type.includes('list_item') ? '  '.repeat(depth) + '・' : '') + t);
      if (bl.has_children && depth < 2) lines.push(...(await blockText(bl.id, depth + 1)));
    }
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return lines;
}
async function profileText() {
  if (Date.now() - profileCache.at < 10 * 60 * 1000) return profileCache.text;
  try { profileCache = { text: (await blockText(PROFILE_PAGE, 0)).join('\n').slice(0, 3500), at: Date.now() }; } catch (e) { profileCache = { text: profileCache.text, at: Date.now() - 9 * 60 * 1000 }; }
  return profileCache.text;
}
function systemWith(profile) {
  if (!profile) return SYSTEM;
  return SYSTEM + `

【本人の自己取扱説明書（本人が自分で書いたもの。前提として知っておくこと）】
${profile}

【この取扱説明書の使い方】
- 本人を理解するための背景として持っておく。毎回の返事で持ち出さない。必要なときだけ、さりげなく使う。
- 「取扱説明書によると」「あなたは〇〇な人なので」と決めつけない。特性や病名のラベルで本人を説明しない。
- いま本人が話していることを最優先にする。取扱説明書とずれていたら、いまの本人を信じる（人は変わる）。
- 使ってよい場面の例：
  ・ストレスサインのLv3以上に当たる様子（不眠・飲酒が増えた、強い不安、人に会いたくない、全部忘れたい・壊したい、無茶に動く）が見えたら、見方を変えるより先に、休むことや体を整えること（ランニング・読書・睡眠）を一緒に考える。
  ・無理を続けている、結果で自分を責めている様子なら、目標を小さく分けて過程を評価する見方を出す。
  ・選べずに迷っているときは、メリットとデメリットの往復ではなく「自分の評価軸では、どちらに惹かれるか」を問う。
  ・本音を言えずにためこんでいる様子なら、ここでは壁を下げてよいことを伝える。
- Lv7（もう無理だ・助けてほしい・何も感じない）に当たる言葉が出たら、リフレーミングをやめ、安全を最優先にして、信頼できる人や相談窓口に頼るよう促す。`;
}

function phasePrompt(b) {
  const ctx = [
    b.event ? '出来事A：' + b.event : '',
    b.emotions && b.emotions.length ? '最初の感情：' + b.emotions.join('、') : '',
    b.autoThought ? '自動思考（状態B）：' + b.autoThought : '',
    b.diary ? '過去の日記の記録：' + b.diary : '',
    b.view ? '本人が選んだ見方：' + b.view : '',
    b.memory ? '【これまでの記録（参考。本人の過去の言葉）】\n' + String(b.memory).slice(0, 1500) : '',
  ].filter(Boolean).join('\n');
  if (b.phase === 'listen') return ctx + '\n\n出来事と感情を受け止め、そのとき浮かんだ考え（自動思考）を推測して、本人に確かめてください。似た記録があれば、押しつけずに一言だけ触れてよい（例：「9月にも似たモヤっとがありましたね」）。\nJSON: {"reply":"受け止めと確認の言葉（2〜3文）","autoThought":"推測した自動思考（一人称で1文）"}';
  if (b.phase === 'views') return ctx + '\n\n観測条件を変えた3つの見方（反状態C）を示してください。条件は互いに違うものを選ぶこと。これまで気持ちが動いた条件があれば1つ入れ、まだ試していない条件も1つ入れる（拡散を止めない）。過去の日記を見直しているときは、1つを「いまの自分の位置から見る」見方にする。\nJSON: {"intro":"ひとこと（1文）","views":[{"condition":"観測条件の名前（例の中から）","title":"見方の見出し（15字以内）","text":"その条件から見たA（2〜3文）","question":"本人に投げかける問い（1文）"}]}';
  if (b.phase === 'talk') return ctx + '\n\nここまでの対話：\n' + (b.messages || []).map((m) => (m.role === 'user' ? '本人：' : 'エルフ：') + m.text).join('\n') + '\n\n本人の最後の言葉に応えてください。押しつけず、問いを1つ添えて広げるか、本人の気づきを言葉にして返す。\nJSON: {"reply":"エルフの返事"}';
  if (b.phase === 'close') return ctx + '\n\nここまでの対話：\n' + (b.messages || []).map((m) => (m.role === 'user' ? '本人：' : 'エルフ：') + m.text).join('\n') + '\n\n変化後の感情：' + (b.after || []).join('、') + '\n\n本人の言葉をなるべく使い、対話を凝縮した「結論」の案と、記録の題名の案を作ってください。最後にエルフからの短い言葉を添えて。\nJSON: {"conclusion":"結論の案（2〜3文・一人称）","opposite":"この対話で見えた反対の見方の要約（1〜2文）","title":"題名の案（20字以内）","themes":["主題（対人関係／自己理解／体調・環境／仕事・学習／生活・趣味／将来・不安 から1〜2個）"],"farewell":"エルフのひとこと（1文）"}';
  return ctx;
}

async function callAI(prompt, system, maxOut) {
  system = system || SYSTEM;
  if (process.env.GEMINI_API_KEY) {
    const models = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let last = '';
    for (const model of models) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, responseMimeType: 'application/json', maxOutputTokens: maxOut || MAX_OUT, thinkingConfig: { thinkingBudget: 0 } } }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) { last = 'Gemini 404'; continue; }
      if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + String((j.error && j.error.message) || '').slice(0, 160));
      const u = j.usageMetadata || {};
      const inTok = u.promptTokenCount || 0, outTok = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
      const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('') || '';
      return { text, model, inTok, outTok, provider: 'Gemini ' + model, blocked: !text && j.promptFeedback && j.promptFeedback.blockReason };
    }
    throw new Error(last || 'Gemini に接続できませんでした');
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.MIND_MODEL || 'claude-haiku-4-5-20251001';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxOut || MAX_OUT, system, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Claude ' + r.status + ': ' + String((j.error && j.error.message) || '').slice(0, 160));
    const u = j.usage || {};
    return { text: (j.content || []).map((c) => c.text || '').join(''), model, inTok: u.input_tokens || 0, outTok: u.output_tokens || 0, provider: 'Claude ' + model };
  }
  throw new Error('AI のキーが未設定です');
}
function parseJSON(text) {
  const s = String(text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(s); } catch (e) { /* 次へ */ }
  const m = s.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) { /* 次へ */ } }
  return { reply: s };
}

async function notion(url, method, body) {
  for (const v of ['2025-09-03', '2022-06-28']) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url(v), { method, headers: H(v), body: body ? JSON.stringify(typeof body === 'function' ? body(v) : body) : undefined });
      if (r.status === 429) { await sleep(1000); continue; }
      if (r.ok) return r.json();
      if (v === '2025-09-03' && (r.status === 400 || r.status === 404)) break;
      const t = await r.text(); const e = new Error(`Notion ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e;
    }
  }
  const e = new Error('Notion に接続できませんでした'); e.status = 404; throw e;
}
const q = (D) => (v) => (v === '2025-09-03' ? `${NOTION}/data_sources/${D.ds}/query` : `${NOTION}/databases/${D.db}/query`);
const names = (p, k) => (p[k]?.multi_select || []).map((x) => x.name);
function diaryOf(pg) {
  const p = pg.properties || {};
  return { pageId: pg.id, title: txt(p['タイトル']), date: p['日付']?.date?.start || '', emotions: names(p, '思考セレクト'), autoThought: txt(p['自動思考']), check: txt(p['検証（メタ的視点）']), conclusion: txt(p['結論']), result: names(p, '結果セレクト') };
}
function mindOf(pg) {
  const p = pg.properties || {};
  return { pageId: pg.id, title: txt(p['タイトル']), date: p['日付']?.date?.start || '', event: txt(p['出来事']), emotions: names(p, '最初の感情'), autoThought: txt(p['自動思考']), conditions: names(p, '観測条件'), opposite: txt(p['反対の見方']), conclusion: txt(p['結論']), after: names(p, '変化後の感情'), input: p['入力']?.select?.name || '', themes: names(p, '主題'), next: p['次回観測日']?.date?.start || '', diaryIds: (p['感情日記']?.relation || []).map((x) => x.id) };
}

// ためた記録をまとめて読む（感情日記は最近400件、心の部屋は最近200件）
async function readAll(D, max, map) {
  const out = []; let cursor;
  do {
    const j = await notion(q(D), 'POST', { page_size: 100, sorts: [{ property: '日付', direction: 'descending' }], ...(cursor ? { start_cursor: cursor } : {}) });
    out.push(...j.results.map(map)); cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor && out.length < max);
  return out;
}
async function loadMemory() {
  const [mindRecs, diary] = await Promise.all([
    readAll(MIND, 200, mindOf),
    readAll(DIARY, 400, diaryOf).then((r) => ({ ok: true, records: r })).catch((e) => ({ ok: false, records: [], message: e.status === 404 ? 'アプリから「感情日記」が見えません（Notionで感情日記の「…」→「接続」から、このアプリを追加してください）' : String(e.message).slice(0, 120) })),
  ]);
  return { mindRecs, diary };
}
// 文字の2文字ずつのかたまりで、似ている度合いを測る
const grams = (t) => { const s2 = String(t || '').replace(/[\s、。！？!?「」（）()・…]/g, ''); const g = new Set(); for (let i = 0; i < s2.length - 1; i++) g.add(s2.slice(i, i + 2)); return g; };
function similarity(a, b) {
  const ea = new Set(a.emotions || []), eb = b.emotions || [];
  const emo = eb.filter((x) => ea.has(x)).length / Math.max(1, Math.min(ea.size, eb.length) || 1);
  const ga = grams(a.text), gb = grams(b.text);
  let hit = 0; ga.forEach((x) => { if (gb.has(x)) hit++; });
  const words = ga.size && gb.size ? hit / Math.sqrt(ga.size * gb.size) : 0;
  return emo * 0.55 + words * 0.45;
}
const isMoved = (after) => (after || []).some((x) => x !== 'まだ変わらない');
// いまの出来事に関係する履歴を集める（活用）
function buildContext(mem, b) {
  const me = { emotions: b.emotions || [], text: [b.event, b.autoThought].join(' ') };
  const pool = [
    ...mem.mindRecs.filter((r) => r.pageId !== b.selfId).map((r) => ({ source: '心の部屋', pageId: r.pageId, date: jstDate(r.date), title: r.title || r.event, emotions: r.emotions, thought: r.autoThought, view: r.opposite, conclusion: r.conclusion, after: r.after, conditions: r.conditions, text: [r.event, r.autoThought].join(' ') })),
    ...mem.diary.records.filter((r) => r.pageId !== b.diaryPageId).map((r) => ({ source: '感情日記', pageId: r.pageId, date: (r.date || '').slice(0, 10), title: r.title, emotions: r.emotions, thought: r.autoThought, view: r.check, conclusion: r.conclusion, after: r.result, conditions: [], text: [r.title, r.autoThought].join(' ') })),
  ];
  const scored = pool.map((r) => ({ ...r, score: similarity(me, r) })).filter((r) => r.score > 0.18).sort((a, b2) => b2.score - a.score);
  const similar = scored.slice(0, 3);
  // 過去の日記を見直すときは、その後の自分（それより新しい、似た記録）
  const later = b.since ? pool.filter((r) => r.date > b.since).map((r) => ({ ...r, score: similarity(me, r) })).filter((r) => r.score > 0.12).sort((a, b2) => a.date.localeCompare(b2.date)).slice(-3) : [];
  // 効いた観測条件：心の部屋で、気持ちが動いた記録で使われた見方
  const cnt = {}; mem.mindRecs.forEach((r) => (r.conditions || []).forEach((c) => { cnt[c] = cnt[c] || { used: 0, moved: 0 }; cnt[c].used++; if (isMoved(r.after)) cnt[c].moved++; }));
  const effective = Object.entries(cnt).filter(([, v]) => v.moved > 0).sort((a, b2) => b2[1].moved / b2[1].used - a[1].moved / a[1].used || b2[1].moved - a[1].moved).slice(0, 3).map(([k]) => k);
  const untried = CONDITIONS.filter((c) => !cnt[c]);
  const since14 = jstDate(Date.now() - 14 * 86400000);
  const recent = mem.mindRecs.filter((r) => jstDate(r.date) >= since14).slice(0, 8).map((r) => (r.emotions || []).slice(0, 2).join('・') + '→' + ((r.after || []).slice(0, 1).join('') || '？')).join('、');
  const line = (r) => `${r.date}［${r.source}］「${String(r.title || '').slice(0, 30)}」感情:${(r.emotions || []).slice(0, 3).join('・')}${r.thought ? '／考え:' + String(r.thought).slice(0, 50) : ''}${r.view ? '／見方:' + String(r.view).slice(0, 60) : ''}${r.conclusion ? '／結論:' + String(r.conclusion).slice(0, 50) : ''}${r.after && r.after.length ? '／その後:' + r.after.slice(0, 2).join('・') : ''}`;
  const text = [
    similar.length ? '似た記録：\n' + similar.map(line).join('\n') : '',
    later.length ? 'この日のその後の記録：\n' + later.map(line).join('\n') : '',
    effective.length ? 'これまで気持ちが動いた観測条件：' + effective.join('、') : '',
    untried.length ? 'まだ試していない観測条件：' + untried.slice(0, 4).join('、') : '',
    recent ? '最近2週間の流れ：' + recent : '',
  ].filter(Boolean).join('\n').slice(0, 1500);
  const pick = (r) => ({ source: r.source, pageId: r.pageId, date: r.date, title: r.title, emotions: (r.emotions || []).slice(0, 4), thought: r.thought, view: r.view, conclusion: r.conclusion, after: r.after });
  return { similar: similar.map(pick), later: later.map(pick), effective, untried, text };
}
// ふりかえり（改善）：心の部屋と感情日記から、傾向を数える
function buildStats(mem) {
  const m = mem.mindRecs, month = jstDate().slice(0, 7);
  const thisMonth = m.filter((r) => jstDate(r.date).slice(0, 7) === month);
  const top = (arr, n) => { const c = {}; arr.forEach((x) => { c[x] = (c[x] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, count: v })); };
  const cond = {}; m.forEach((r) => (r.conditions || []).forEach((c) => { cond[c] = cond[c] || { used: 0, moved: 0 }; cond[c].used++; if (isMoved(r.after)) cond[c].moved++; }));
  const conditions = CONDITIONS.map((c) => ({ name: c, used: (cond[c] || {}).used || 0, moved: (cond[c] || {}).moved || 0 })).sort((a, b) => b.used - a.used);
  const since90 = jstDate(Date.now() - 90 * 86400000);
  const today = jstDate();
  return {
    sessions: m.length, monthSessions: thisMonth.length,
    movedRate: m.length ? Math.round((m.filter((r) => isMoved(r.after)).length / m.length) * 100) : 0,
    topBefore: top(thisMonth.flatMap((r) => r.emotions || []), 5), topAfter: top(thisMonth.flatMap((r) => r.after || []), 5),
    themes: top(m.flatMap((r) => r.themes || []), 6), conditions,
    nextTry: CONDITIONS.filter((c) => !(cond[c] && cond[c].used)).slice(0, 2),
    diaryLong: mem.diary.ok ? top(mem.diary.records.filter((r) => (r.date || '') >= since90).flatMap((r) => r.emotions || []), 5) : [],
    diaryCount: mem.diary.records.length,
    revisit: m.filter((r) => r.next && r.next <= today).slice(0, 5).map((r) => ({ pageId: r.pageId, title: r.title || r.event, date: jstDate(r.date), next: r.next, event: r.event, emotions: r.emotions, autoThought: r.autoThought, conclusion: r.conclusion })),
  };
}
async function lastJournal() {
  try { const j = await notion(q(JOURNAL), 'POST', { page_size: 7, sorts: [{ property: '日付', direction: 'descending' }] }); return j.results.map((pg) => { const p = pg.properties || {}; return { date: p['日付']?.date?.start || '', line: txt(p['一行の結晶']), weather: p['心の天気']?.select?.name || '' }; }).filter((x) => x.line); } catch (e) { return []; }
}

export async function mind(req, res) {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
      if (req.query.diary) {
        try {
          const j = await notion(q(DIARY), 'POST', { page_size: 40, sorts: [{ property: '日付', direction: 'descending' }] });
          return res.status(200).json({ available: true, records: j.results.map(diaryOf) });
        } catch (e) {
          return res.status(200).json({ available: false, records: [], message: e.status === 404 ? 'アプリから「感情日記」が見えません。Notion で感情日記のページを開き、右上の「…」→「接続」から、このアプリのインテグレーションを追加してください。' : String(e.message).slice(0, 160) });
        }
      }
      const mem = await loadMemory();
      let usage = null; try { const r2 = await usageRow(); usage = { used: Math.round(r2.yen * 10) / 10, cap: BUDGET_YEN, calls: r2.calls, voiceUsed: r2.voiceChars || 0, voiceCap: VOICE.cap }; } catch (e) { /* 続ける */ }
      return res.status(200).json({ voice: !!VOICE.key, records: mem.mindRecs.slice(0, 50), ai: process.env.GEMINI_API_KEY ? 'gemini' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : '', usage, diary: { ok: mem.diary.ok, count: mem.diary.records.length, message: mem.diary.message || '' }, stats: buildStats(mem), journal: await lastJournal() });
    }
    if (req.method !== 'POST') return res.status(405).end();
    if (process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (b.action === 'tts') {
      if (!VOICE.key) return res.status(503).json({ error: 'エルフの声はまだ準備中です（ELEVENLABS_API_KEY が未設定）' });
      const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      if (!text) return res.status(400).json({ error: 'text が空です' });
      let row;
      try { row = await usageRow(); } catch (e) { return res.status(503).json({ error: '利用量を確かめられないため、いまは声を出せません' }); }
      const add = ttsYen(text.length, VOICE.model);
      if ((row.voiceChars || 0) + text.length > VOICE.cap) return res.status(429).json({ error: '今月のエルフの声は使い切りました（' + VOICE.cap + '文字）。来月また話せます。', voice: true });
      if (row.yen + add > BUDGET_YEN) return res.status(429).json({ error: '今月の上限（' + BUDGET_YEN + '円）に達したので、声はお休みです。', budget: true });
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.voice}?output_format=mp3_44100_64`, { method: 'POST', headers: { 'xi-api-key': VOICE.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: VOICE.model }) });
      if (!r.ok) { const t = await r.text().catch(() => ''); return res.status(502).json({ error: 'ElevenLabs ' + r.status + ': ' + t.slice(0, 140) }); }
      const buf = Buffer.from(await r.arrayBuffer());
      try { await addVoice(row, text.length, add); } catch (e) { /* 記録に失敗しても声は返す */ }
      return res.status(200).json({ audio: 'data:audio/mpeg;base64,' + buf.toString('base64'), voiceUsed: (row.voiceChars || 0) + text.length, voiceCap: VOICE.cap });
    }
    if (b.action === 'context') {
      const mem = await loadMemory();
      return res.status(200).json({ ...buildContext(mem, b), diary: { ok: mem.diary.ok, message: mem.diary.message || '' } });
    }
    if (b.action === 'ai') {
      // 本人の言葉に命に関わる表現があれば、AI には渡さず、相談先を返す
      const said = [b.event, b.autoThought, ...((b.messages || []).filter((m) => m.role === 'user').map((m) => m.text))].join(' ');
      if (CRISIS.test(said)) return res.status(200).json(CRISIS_REPLY);
      const prompt = phasePrompt(b);
      const system = systemWith(await profileText());
      // 予算の確認（読めなければ安全のため呼ばない）
      let row;
      try { row = await usageRow(); } catch (e) { return res.status(503).json({ error: '利用量を確かめられないため、いまはエルフが話せません（' + String(e.message).slice(0, 60) + '）' }); }
      const model = process.env.GEMINI_API_KEY ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash') : (process.env.MIND_MODEL || 'claude-haiku-4-5-20251001');
      const worst = yenOf(model, Math.ceil((system.length + prompt.length) * 1.2), MAX_OUT);
      if (row.yen + worst > BUDGET_YEN) return res.status(429).json({ error: '今月のAIの上限（' + BUDGET_YEN + '円）に達したので、エルフは来月まで休んでいます。記録を残すことはできます。', budget: true, used: row.yen, cap: BUDGET_YEN });
      const out = await callAI(prompt, system);
      let used = row.yen;
      try { used = await addUsage(row, out.model, out.inTok, out.outTok); } catch (e) { /* 記録に失敗しても返事は返す */ }
      if (out.blocked || !out.text) return res.status(502).json({ error: 'エルフから返事がありませんでした' + (out.blocked ? '（' + out.blocked + '）' : '') });
      const data = parseJSON(out.text);
      return res.status(200).json({ ...data, provider: out.provider, used: Math.round(used), cap: BUDGET_YEN });
    }
    if (b.action === 'save') {
      if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
      const r = b.record || {};
      const log = (r.messages || []).map((m) => (m.role === 'user' ? '私：' : 'エルフ：') + m.text).join('\n');
      const status = { mind: false, diary: '', link: '', refs: 0 };
      // 1) 感情日記に書く（いまの出来事のとき。過去の日記を見直したときは、その日記につなぐ）
      let diaryId = r.diaryPageId || '';
      if (!diaryId && r.writeDiary !== false) {
        try {
          const dp = await notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: DIARY.ds } : { database_id: DIARY.db }, icon: { type: 'emoji', emoji: '🌿' }, properties: {
            'タイトル': { title: [{ text: { content: String(r.title || r.event || '心の部屋').slice(0, 100) } }] },
            '日付': { date: { start: jstDate() } }, 'タブ': { select: { name: '生活' } },
            '思考セレクト': ms((r.emotions || []).filter((x) => DIARY_EMO.includes(x))), '自動思考': rtLong(r.autoThought),
            '検証（メタ的視点）': rtLong(r.opposite), '結論': rtLong(r.conclusion), '結果セレクト': ms((r.after || []).filter((x) => DIARY_RES.includes(x))),
          } }));
          diaryId = dp.id; status.diary = 'created';
        } catch (e) { status.diary = 'failed: ' + (e.status === 404 ? '感情日記に接続されていません' : String(e.message).slice(0, 80)); }
      } else if (diaryId) status.diary = 'linked';
      // 2) 心の部屋に書き、感情日記と参考にした記録をつなぐ
      const refs = (r.refs || []).filter((x) => x && x !== diaryId).slice(0, 5);
      const props = {
        'タイトル': { title: [{ text: { content: String(r.title || r.event || '心の部屋').slice(0, 100) } }] },
        '日付': { date: { start: nowJst() } },
        '出来事': rtLong(r.event), '入力': { select: { name: ['音声', '文字', '過去の日記'].includes(r.input) ? r.input : '文字' } },
        '最初の感情': ms(r.emotions), '自動思考': rtLong(r.autoThought), '観測条件': ms((r.conditions || []).filter((c) => CONDITIONS.includes(c))),
        '反対の見方': rtLong(r.opposite), '対話の記録': rtLong(log), '結論': rtLong(r.conclusion), '変化後の感情': ms(r.after),
        '主題': ms((r.themes || []).filter((t) => THEMES.includes(t))),
      };
      if (r.next) props['次回観測日'] = { date: { start: r.next } };
      const withLinks = { ...props };
      if (diaryId) withLinks['感情日記'] = { relation: [{ id: diaryId }] };
      if (refs.length) withLinks['参考にした記録'] = { relation: refs.map((id) => ({ id })) };
      const make = (pr) => notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: v === '2025-09-03' ? { type: 'data_source_id', data_source_id: MIND.ds } : { database_id: MIND.db }, icon: { type: 'emoji', emoji: '🌿' }, properties: pr }));
      let pg;
      try { pg = await make(withLinks); status.link = diaryId || refs.length ? 'ok' : ''; status.refs = refs.length; }
      catch (e) { pg = await make(props); status.link = 'failed: ' + String(e.message).slice(0, 80); }
      status.mind = true;
      return res.status(200).json({ record: mindOf(pg), status });
    }
    return res.status(400).json({ error: 'action が不明です' });
  } catch (e) { return res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}

// My Factory など、ほかの施設とAI・予算・Notionの道具を共有する
export { callAI, usageRow, addUsage, yenOf, BUDGET_YEN, MAX_OUT, notion, q, parseJSON, jstDate, nowJst, rt, rtLong, ms, txt, CRISIS, CRISIS_REPLY };
