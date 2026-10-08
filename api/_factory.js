// /api/factory（vercel.json の rewrites で /api/meter-notion?mode=factory に回す）
// My Factory：搬入（ドワーフとの会話）→ Notion で仕分け・計画 → 作業台（タイマー・作業ログ）→ 出荷。
import { callAI, usageRow, addUsage, yenOf, BUDGET_YEN, MAX_OUT, notion, q, parseJSON, jstDate, nowJst, rtLong, txt, CRISIS, CRISIS_REPLY } from './_mind.js';

const NOTION = 'https://api.notion.com/v1';
const LINE = { ds: process.env.FACTORY_DATA_SOURCE_ID || '50bb7196-17f7-40d1-888e-5c534fde5fb3', db: process.env.FACTORY_DATABASE_ID || 'e3c5747f5a0b4eb3b89b399633a7cb59' };
const PROJ = { ds: process.env.PROJECT_DATA_SOURCE_ID || 'f52d33bf-32dd-40ed-9f68-1069c8499ea3', db: process.env.PROJECT_DATABASE_ID || '' };
const LOGS = { ds: process.env.WORKLOG_DATA_SOURCE_ID || '440be696-acb9-46b2-8628-67b0afc52f2e', db: process.env.WORKLOG_DATABASE_ID || 'b9a6ad556f6849de9ad4657ba53bd5dd' };
const AREAS = ['仕事', 'プライベート'], KINDS = ['単発', '定型', 'プロジェクト'], REPEATS = ['毎日', '平日', '毎週', '毎月', 'なし'], LEVELS = ['親', '子', '孫'], ENERGY = ['High', 'Mid', 'Low'];
const DONE = '出荷済み';
const sel = (p, k) => p[k]?.select?.name || '';
const day = (p, k) => p[k]?.date?.start || '';
const rel = (p, k) => (p[k]?.relation || []).map((x) => x.id);
const pick = (v, list, d) => (list.includes(v) ? v : d);
const parent = (D) => (v) => (v === '2025-09-03' ? { type: 'data_source_id', data_source_id: D.ds } : { database_id: D.db });

function taskOf(pg) {
  const p = pg.properties || {};
  return {
    id: pg.id, title: txt(p['タスク']), stage: sel(p, '工程'), priority: sel(p, '優先度'), owner: sel(p, '担当'), area: sel(p, '領域'), kind: sel(p, '種類'),
    repeat: sel(p, '繰り返し'), level: sel(p, '階層'), energy: sel(p, 'エネルギー'), est: p['見積分']?.number || 0, actual: p['実績分']?.number || 0,
    due: day(p, '期限'), plan: day(p, '予定日'), started: day(p, '着手日時'), shipped: day(p, '出荷日'), next: txt(p['次の一手']),
    parents: rel(p, '親タスク'), projects: rel(p, 'プロジェクト'), postponed: p['後回し回数']?.number || 0, notify: (p['通知']?.multi_select || []).map((x) => x.name),
  };
}
const projectOf = (pg) => { const p = pg.properties || {}; return { id: pg.id, name: txt(p['プロジェクト']), area: sel(p, '領域'), state: sel(p, '状態'), due: day(p, '期限'), goal: txt(p['ゴール']) }; };
async function readAll(D, body, map, max = 300) {
  const out = []; let cursor;
  do {
    const j = await notion(q(D), 'POST', { page_size: 100, ...body, ...(cursor ? { start_cursor: cursor } : {}) });
    out.push(...j.results.map(map)); cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor && out.length < max);
  return out;
}
const since = (n) => jstDate(Date.now() - n * 86400000);
async function board() {
  const [open, done, projects] = await Promise.all([
    readAll(LINE, { filter: { property: '工程', select: { does_not_equal: DONE } } }, taskOf),
    readAll(LINE, { filter: { and: [{ property: '工程', select: { equals: DONE } }, { property: '出荷日', date: { on_or_after: since(14) } }] } }, taskOf, 100),
    readAll(PROJ, { filter: { property: '状態', select: { does_not_equal: '完了' } } }, projectOf, 100).catch(() => []),
  ]);
  return { tasks: [...open, ...done], projects };
}
async function logsOf(from) {
  return readAll(LOGS, { filter: { property: '開始', date: { on_or_after: from } }, sorts: [{ property: '開始', direction: 'descending' }] }, (pg) => {
    const p = pg.properties || {};
    return { id: pg.id, title: txt(p['内容']), task: rel(p, 'タスク')[0] || '', start: day(p, '開始'), end: day(p, '終了'), min: p['分']?.number || 0, result: sel(p, '結果'), focus: sel(p, '集中度'), area: sel(p, '領域') };
  }, 200);
}

// ---- 工場長ドワーフ（AI）
const DWARF = `あなたは「My Library」の世界の工場「My Factory」を仕切る工場長のドワーフです。口調は職人らしく率直で温かい（「〜だな」「任せとけ」程度。乱暴にはしない）。日本語で短く話す。
役目は2つ。
1) 質問（予定・プロジェクトの進み具合・何がどのプロジェクトにつながっているか・今日やること）には、【工場の現状】をもとに具体的に答える。このとき items は空にする。
2) 新しくやることを話されたら、整理して生産ラインに載せる案を出す。
- 領域：仕事／プライベート。種類：単発／定型（繰り返し：毎日・平日・毎週・毎月）／プロジェクト。
- 大きな話は 親→子→孫 に分ける。手を動かすのは一番下の層。孫（または一番下）は30分以内で終わる大きさにし、15分で始められる「次の一手」を付ける。
- 既存のプロジェクトや親タスクと同じなら、新しく作らず既存につなぐ（existing に id を入れる）。
- 迷う点があれば、質問は1つだけ。わかる範囲で案は必ず出す。
- 答えるときは、プロジェクトにつながるものと、つながらないもの（単発・定型）を区別して伝える。現状にないことは推測で言わない。
- 優先度は決めない（Notion の Triage が決める）。期限は本人が言ったときだけ入れる（YYYY-MM-DD）。
- 無理な詰め込みや自己否定につながる言い方をしない。本人は「結果ではなく過程」を大事にしている。
出力はJSONだけ。前置きやコードブロックは付けない。`;
function summary(ctx) {
  const t0 = jstDate(), end = jstDate(Date.now() + 14 * 86400000);
  const leaf = ctx.tasks.filter((t) => !ctx.tasks.some((x) => x.parents.includes(t.id) && x.stage !== DONE));
  const proj = (t, d = 0) => { if (t.projects.length) return t.projects[0]; if (d > 4) return ''; for (const pid of t.parents) { const p = ctx.tasks.find((x) => x.id === pid); const r = p && proj(p, d + 1); if (r) return r; } return ''; };
  const pname = (id) => (ctx.projects.find((p) => p.id === id) || {}).name || '';
  const line = (t) => `${t.title}［${pname(proj(t)) || (t.kind === '定型' ? '定型' : '単発')}］${t.plan ? '予定' + t.plan.slice(5, 10) : ''}${t.due ? '期限' + t.due.slice(5, 10) : ''}${t.priority ? ' ' + t.priority.slice(0, 1) : ''}`;
  const open = leaf.filter((t) => t.stage !== DONE);
  return [
    'プロジェクト：' + (ctx.projects.map((p) => { const ts = leaf.filter((t) => proj(t) === p.id); const d = ts.filter((t) => t.stage === DONE).length; return `${p.name}（${d}/${ts.length}完了${p.due ? '・期限' + p.due.slice(5, 10) : ''}）`; }).join('、') || 'なし'),
    '今日：' + (open.filter((t) => (t.plan && t.plan.slice(0, 10) <= t0) || (t.priority || '').startsWith('①')).map(line).join('／') || 'なし'),
    'これから2週間：' + (open.filter((t) => t.plan && t.plan.slice(0, 10) > t0 && t.plan.slice(0, 10) <= end).sort((a, b) => a.plan.localeCompare(b.plan)).slice(0, 25).map(line).join('／') || 'なし'),
    '日付未定：' + (open.filter((t) => !t.plan).slice(0, 15).map(line).join('／') || 'なし'),
    '最近の出荷：' + (leaf.filter((t) => t.stage === DONE).slice(0, 8).map((t) => t.title).join('、') || 'なし'),
  ].join('\n').slice(0, 3500);
}
function dwarfPrompt(b, ctx) {
  const today = jstDate();
  return `今日：${today}
【工場の現状】
${summary(ctx)}
既存のプロジェクト：${ctx.projects.map((p) => `${p.name}(${p.id})`).join('、') || 'なし'}
進行中の親タスク：${ctx.parents.map((t) => `${t.title}(${t.id})`).join('、') || 'なし'}
これまでの会話：
${(b.messages || []).map((m) => (m.role === 'user' ? '本人：' : '工場長：') + m.text).join('\n')}

本人の最新の言葉が質問なら答え（items は []）、新しくやることなら整理案を出してください。
JSON: {"reply":"工場長の返事（質問への答えは具体的に4〜6文まで。整理のときはどう分けたかを2〜3文で）","question":"確認したいこと（なければ空）","project":{"existing":"既存プロジェクトのid（なければ空）","name":"新規のときのプロジェクト名（不要なら空）","area":"仕事|プライベート","goal":"ゴール（1文）"},"items":[{"key":"a1","title":"タスク名","level":"親|子|孫","parent":"親の key か 既存親タスクのid（なければ空）","area":"仕事|プライベート","kind":"単発|定型|プロジェクト","repeat":"毎日|平日|毎週|毎月|なし","estimate":分の数,"energy":"High|Mid|Low","due":"YYYY-MM-DD か 空","next":"次の一手（15分で始められる行動）"}]}`;
}

// ---- 朝の仕事：後回しの数を数え、今日の生産計画をまとめる（cron-meter から呼ぶ）
export async function factoryMorning() {
  const today = jstDate();
  const open = await readAll(LINE, { filter: { property: '工程', select: { does_not_equal: DONE } } }, taskOf);
  let bumped = 0;
  for (const t of open) {
    if (t.plan && t.plan.slice(0, 10) < today && t.stage !== '保留') {
      await notion(() => `${NOTION}/pages/${t.id}`, 'PATCH', { properties: { '後回し回数': { number: t.postponed + 1 } } }).catch(() => {});
      bumped++;
    }
  }
  const todays = open.filter((t) => (t.plan || '').slice(0, 10) === today);
  const urgent = open.filter((t) => t.priority.startsWith('①'));
  const soon = open.filter((t) => t.due && t.due.slice(0, 10) <= jstDate(Date.now() + 86400000));
  const minutes = todays.reduce((s, t) => s + (t.est || 0), 0);
  const line = (t) => `・${t.title}${t.est ? `（${t.est}分）` : ''}${t.due ? ` 期限${t.due.slice(5, 10)}` : ''}${t.postponed >= 3 ? ' ←後回し' + t.postponed + '回' : ''}`;
  const text = [`おはよう。今日の生産計画だ（${today}）。`, '', `■ ① 緊急×重要（${urgent.length}件）`, ...urgent.slice(0, 8).map(line), '', `■ 今日の予定（${todays.length}件・見積${minutes}分）`, ...todays.slice(0, 12).map(line), '', `■ 期限が近いもの（${soon.length}件）`, ...soon.slice(0, 8).map(line), '', '無理に全部はやらなくていい。まず「次の一手」をひとつだけな。', '— My Factory 工場長'].join('\n');
  let mailed = '';
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
      await tr.sendMail({ from: `My Factory <${process.env.GMAIL_USER}>`, to: process.env.FACTORY_MAIL_TO || process.env.GMAIL_USER, subject: `今日の生産計画：①${urgent.length}件・予定${todays.length}件`, text });
      mailed = 'sent';
    } catch (e) { mailed = 'failed: ' + String(e.message).slice(0, 80); }
  } else mailed = 'skipped (GMAIL_USER / GMAIL_APP_PASSWORD 未設定)';
  return { bumped, today: todays.length, urgent: urgent.length, mailed };
}

export async function factory(req, res) {
  try {
    if (!process.env.NOTION_TOKEN) return res.status(503).json({ error: 'NOTION_TOKEN が未設定です' });
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      if (req.query.view === 'alerts') {
        const open = await readAll(LINE, { filter: { property: '工程', select: { does_not_equal: DONE } } }, taskOf);
        const tomorrow = jstDate(Date.now() + 86400000), today = jstDate();
        return res.status(200).json({
          urgent: open.filter((t) => t.priority.startsWith('①')).map((t) => ({ id: t.id, title: t.title })).slice(0, 5),
          soon: open.filter((t) => t.due && t.due.slice(0, 10) <= tomorrow).map((t) => ({ id: t.id, title: t.title, due: t.due })).slice(0, 5),
          today: open.filter((t) => (t.plan || '').slice(0, 10) === today).length,
          stuck: open.filter((t) => t.postponed >= 3).map((t) => ({ id: t.id, title: t.title, n: t.postponed })).slice(0, 3),
        });
      }
      const [b, logs] = await Promise.all([board(), logsOf(since(14)).catch(() => [])]);
      return res.status(200).json({ ...b, logs });
    }
    if (req.method !== 'POST') return res.status(405).end();
    if (process.env.APP_PASSCODE && req.headers['x-app-key'] !== process.env.APP_PASSCODE) return res.status(401).json({ error: 'passcode' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (b.action === 'dwarf') {
      const said = (b.messages || []).filter((m) => m.role === 'user').map((m) => m.text).join(' ');
      if (CRISIS.test(said)) return res.status(200).json(CRISIS_REPLY);
      const ctx = await board();
      const prompt = dwarfPrompt(b, { projects: ctx.projects, tasks: ctx.tasks, parents: ctx.tasks.filter((t) => t.level === '親' && t.stage !== DONE).slice(0, 30) });
      let row; try { row = await usageRow(); } catch (e) { return res.status(503).json({ error: '利用量を確かめられないため、いまは工場長が話せません' }); }
      const model = process.env.GEMINI_API_KEY ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash') : (process.env.MIND_MODEL || 'claude-haiku-4-5-20251001');
      if (row.yen + yenOf(model, Math.ceil((DWARF.length + prompt.length) * 1.2), MAX_OUT * 2) > BUDGET_YEN) return res.status(429).json({ error: '今月のAIの上限（' + BUDGET_YEN + '円）に達したので、工場長は来月まで休みだ。手で登録はできるぞ。' });
      const out = await callAI(prompt, DWARF, MAX_OUT * 2);
      try { await addUsage(row, out.model, out.inTok, out.outTok); } catch (e) { /* 続ける */ }
      const plan = parseJSON(out.text);
      return res.status(200).json({ ...plan, projects: ctx.projects });
    }

    if (b.action === 'commit') {
      // 案を生産ラインに搬入する（親を先に作り、子・孫をつなぐ）
      const plan = b.plan || {}; const items = (plan.items || []).slice(0, 30);
      let projectId = plan.project?.existing || '';
      if (!projectId && plan.project?.name) {
        const pp = await notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: parent(PROJ)(v), icon: { type: 'emoji', emoji: '📦' }, properties: {
          'プロジェクト': { title: [{ text: { content: String(plan.project.name).slice(0, 100) } }] }, '領域': { select: { name: pick(plan.project.area, AREAS, '仕事') } },
          '状態': { select: { name: '進行中' } }, 'ゴール': rtLong(plan.project.goal),
        } }));
        projectId = pp.id;
      }
      const made = {}; const order = [...items].sort((a, b2) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b2.level));
      for (const it of order) {
        const par = it.parent ? (made[it.parent] || (/^[0-9a-f-]{32,36}$/.test(it.parent) ? it.parent : '')) : '';
        const props = {
          'タスク': { title: [{ text: { content: String(it.title || '（無題）').slice(0, 100) } }] }, '工程': { select: { name: '搬入' } }, '担当': { select: { name: '🧭 Triage' } },
          '領域': { select: { name: pick(it.area, AREAS, '仕事') } }, '種類': { select: { name: pick(it.kind, KINDS, '単発') } }, '繰り返し': { select: { name: pick(it.repeat, REPEATS, 'なし') } },
          '階層': { select: { name: pick(it.level, LEVELS, '子') } }, 'エネルギー': { select: { name: pick(it.energy, ENERGY, 'Mid') } },
          '次の一手': rtLong(it.next), '原文': rtLong(b.raw), '入力元': { select: { name: b.input === '音声' ? '音声' : '文字' } }, 'AIメモ': rtLong(b.note || '工場長の整理：' + (plan.reply || '')),
        };
        if (it.priority) Object.assign(props, { '優先度': { select: { name: it.priority } }, '工程': { select: { name: it.plan ? '計画済み' : '仕分け済み' } }, '担当': { select: { name: '👤 自分' } } });
        if (/^\d{4}-\d{2}-\d{2}$/.test(it.plan || '')) props['予定日'] = { date: { start: it.plan } };
        if (Number(it.estimate) > 0) props['見積分'] = { number: Math.round(Number(it.estimate)) };
        if (/^\d{4}-\d{2}-\d{2}$/.test(it.due || '')) props['期限'] = { date: { start: it.due } };
        if (par) props['親タスク'] = { relation: [{ id: par }] };
        if (projectId) props['プロジェクト'] = { relation: [{ id: projectId }] };
        const pg = await notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: parent(LINE)(v), properties: props }));
        made[it.key || it.title] = pg.id;
      }
      return res.status(200).json({ created: Object.keys(made).length, projectId, made });
    }

    if (b.action === 'start') {
      const props = { '工程': { select: { name: '作業中' } }, '担当': { select: { name: '👤 自分' } } };
      if (!b.started) props['着手日時'] = { date: { start: nowJst() } };
      await notion(() => `${NOTION}/pages/${b.id}`, 'PATCH', { properties: props });
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'stop') {
      // 作業ログを1件残し、タスクの実績分に足す
      const min = Math.max(1, Math.round(Number(b.minutes) || 0));
      await notion(() => `${NOTION}/pages`, 'POST', (v) => ({ parent: parent(LOGS)(v), properties: {
        '内容': { title: [{ text: { content: String(b.title || '作業').slice(0, 100) } }] }, 'タスク': { relation: [{ id: b.id }] },
        '開始': { date: { start: b.start } }, '終了': { date: { start: b.end || nowJst() } }, '分': { number: min },
        '領域': { select: { name: pick(b.area, AREAS, '仕事') } }, '結果': { select: { name: pick(b.result, ['進んだ', '終わった', '中断', '進まなかった'], '進んだ') } },
        '集中度': { select: { name: pick(b.focus, ['高', '中', '低'], '中') } }, '中断の理由': rtLong(b.reason), 'メモ': rtLong(b.memo),
      } }));
      const props = { '実績分': { number: Math.round((Number(b.actual) || 0) + min) } };
      if (b.result === '終わった') Object.assign(props, { '工程': { select: { name: b.review ? '検品待ち' : DONE } }, ...(b.review ? {} : { '出荷日': { date: { start: jstDate() } } }) });
      await notion(() => `${NOTION}/pages/${b.id}`, 'PATCH', { properties: props });
      return res.status(200).json({ ok: true, minutes: min });
    }

    if (b.action === 'update') {
      const f = b.fields || {}; const props = {};
      if ('plan' in f) props['予定日'] = f.plan ? { date: { start: f.plan } } : { date: null };
      if (f.stage) props['工程'] = { select: { name: f.stage } };
      if (f.stage === DONE) props['出荷日'] = { date: { start: jstDate() } };
      if ('memo' in f) props['出荷メモ'] = rtLong(f.memo);
      if (f.title) props['タスク'] = { title: [{ text: { content: String(f.title).slice(0, 100) } }] };
      if ('est' in f) props['見積分'] = { number: f.est === '' || f.est == null ? null : Math.max(0, Math.round(Number(f.est))) };
      if ('actual' in f) props['実績分'] = { number: Math.max(0, Math.round(Number(f.actual) || 0)) };
      if ('due' in f) props['期限'] = f.due ? { date: { start: f.due } } : { date: null };
      if ('next' in f) props['次の一手'] = rtLong(f.next);
      if (f.area) props['領域'] = { select: { name: pick(f.area, AREAS, '仕事') } };
      if ('priority' in f) props['優先度'] = f.priority ? { select: { name: f.priority } } : { select: null };
      if (f.kind) props['種類'] = { select: { name: pick(f.kind, KINDS, '単発') } };
      if (f.repeat) props['繰り返し'] = { select: { name: pick(f.repeat, REPEATS, 'なし') } };
      if (f.energy) props['エネルギー'] = { select: { name: pick(f.energy, ENERGY, 'Mid') } };
      await notion(() => `${NOTION}/pages/${b.id}`, 'PATCH', { properties: props });
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'editLog') {
      // 作業ログの時間・結果を直し、タスクの実績分も差分だけ直す
      const min = Math.max(0, Math.round(Number(b.minutes) || 0));
      const props = { '分': { number: min } };
      if (b.result) props['結果'] = { select: { name: pick(b.result, ['進んだ', '終わった', '中断', '進まなかった'], '進んだ') } };
      if (b.del) await notion(() => `${NOTION}/pages/${b.logId}`, 'PATCH', { archived: true });
      else await notion(() => `${NOTION}/pages/${b.logId}`, 'PATCH', { properties: props });
      if (b.taskId) await notion(() => `${NOTION}/pages/${b.taskId}`, 'PATCH', { properties: { '実績分': { number: Math.max(0, Math.round((Number(b.actual) || 0) - (Number(b.oldMinutes) || 0) + (b.del ? 0 : min))) } } });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'action が不明です' });
  } catch (e) { return res.status(502).json({ error: String(e.message || e).slice(0, 300) }); }
}
