// 蔵書データ：葛飾区立図書館の貸出履歴 ＋ Notion「小説作成賞」DB（文学賞）
import READ_BOOKS from './read-books.json';
import PRIZE_BOOKS from './prize-books.json';

// 借りるボタンの行き先（葛飾区立図書館）。jsessionid 入りの URL は時間が経つと切れることがあるので、
// 切れていたらここを書き換える。
export const BORROW_URL = 'https://www.lib.city.katsushika.lg.jp/contents;jsessionid=62E42934AFD896BEA336F5CF585876C6?0&pid=323';
export const amazonUrl = (title, author) => 'https://www.amazon.co.jp/s?k=' + encodeURIComponent((title + ' ' + (author || '')).trim());

// 書架に並べる順（東の壁、入口側から）
export const PRIZE_ORDER = ['芥川賞', '直木賞', '本屋大賞', '三島由紀夫賞', '山本周五郎賞', '谷崎潤一郎賞', '江戸川乱歩賞', 'すばる文学賞', 'このミステリーがすごい'];
export const PRIZE_SHORT = { 'このミステリーがすごい': 'このミス大賞', '江戸川乱歩賞': '乱歩賞', '山本周五郎賞': '山周賞', '谷崎潤一郎賞': '谷崎賞', '三島由紀夫賞': '三島賞', 'すばる文学賞': 'すばる賞' };
export const prizeName = (p) => (p === 'このミステリーがすごい' ? '『このミステリーがすごい！』大賞' : p);

export const UNREAD_BOOKS = [['サピエンス全史','ユヴァル・ノア・ハラリ'],['ファスト＆スロー','ダニエル・カーネマン'],['銃・病原菌・鉄','ジャレド・ダイアモンド'],['イノベーションのジレンマ','クレイトン・クリステンセン'],['ビジョナリー・カンパニー','ジム・コリンズ'],['利己的な遺伝子','リチャード・ドーキンス'],['コスモス','カール・セーガン'],['夜と霧','ヴィクトール・E・フランクル'],['予想どおりに不合理','ダン・アリエリー'],['ブラック・スワン','ナシーム・ニコラス・タレブ'],['競争の戦略','マイケル・E・ポーター'],['統計学が最強の学問である','西内啓'],['影響力の武器','ロバート・B・チャルディーニ'],['FACTFULNESS','ハンス・ロスリング'],['ホモ・デウス','ユヴァル・ノア・ハラリ'],['エッセンシャル思考','グレッグ・マキューン'],['イシューからはじめよ','安宅和人'],['思考の整理学','外山滋比古'],['重力とは何か','大栗博司'],['時間は存在しない','カルロ・ロヴェッリ']];

export const norm = (s) => (s || '').normalize('NFKC').toLowerCase().replace(/[\s・\-－―─「」『』()（）:：、。!！?？.,]/g, '');
const titleKey = (t) => norm((t || '').replace(/[（(][^）)]*[）)]/g, '').split(/[－―]/)[0]);

export const RECS = [];
const byTitle = new Map();
function index(rec) {
  const k = titleKey(rec.t);
  if (!byTitle.has(k)) byTitle.set(k, []);
  byTitle.get(k).push(rec);
}
function find(t, a) {
  const list = byTitle.get(titleKey(t)) || [];
  const ak = norm(a);
  return list.find((r) => !ak || !norm(r.a) || norm(r.a) === ak) || null;
}
const primaryPrize = (rec) => rec.prizes.slice().sort((x, y) => PRIZE_ORDER.indexOf(x.p) - PRIZE_ORDER.indexOf(y.p))[0] || null;

function addLib(t, a, d) {
  const rec = { t, a, d, baseRead: true, fromLib: true, prizes: [], id: RECS.length };
  RECS.push(rec); index(rec); return rec;
}
function addPrizeRow(row) {
  const [t, a, p, n, y, label, r] = row;
  let rec = find(t, a);
  if (rec) {
    if (!rec.prizes.some((x) => x.p === p && x.n === n)) rec.prizes.push({ p, n, y, label });
    if (!rec.a && a) rec.a = a;
    if (r) rec.baseRead = true;
    rec.primary = primaryPrize(rec);
    return { rec, created: false };
  }
  rec = { t, a, d: '', baseRead: !!r, fromLib: false, prizes: [{ p, n, y, label }], id: RECS.length };
  rec.primary = rec.prizes[0];
  RECS.push(rec); index(rec);
  return { rec, created: true };
}

READ_BOOKS.forEach(([t, a, d]) => addLib(t, a, d));
PRIZE_BOOKS.forEach(addPrizeRow);
UNREAD_BOOKS.forEach(([t, a]) => { if (!find(t, a)) { const rec = { t, a, d: '', baseRead: false, fromLib: false, prizes: [], id: RECS.length }; RECS.push(rec); index(rec); } });
RECS.forEach((r) => { if (r.prizes.length) r.primary = primaryPrize(r); });

// Notion や公式発表から届いた行をまとめて反映する。新しく増えた本の id を返す
export function mergeRemote(rows) {
  const added = [];
  rows.forEach((row) => {
    const { rec, created } = addPrizeRow(row);
    if (created) added.push(rec.id);
    else if (row[6] && !rec.fromLib) rec.baseRead = true;
  });
  reindex();
  return added;
}

// 自分でつけた「読んだ」印（ブラウザに保存）
const KEY = 'my-library:marks:v1';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const marks = load(KEY, {});
const keyOf = (r) => r.t + '|' + r.a;
export function isRead(r) { const m = marks[keyOf(r)]; return m === undefined ? r.baseRead : m; }
export function setRead(r, v) { const k = keyOf(r); if (v === r.baseRead) delete marks[k]; else marks[k] = v; save(KEY, marks); }
export const readCount = () => RECS.filter(isRead).length;

// かばん（カウンターへ持っていく本）
const BAG_KEY = 'my-library:bag:v1';
const bag = load(BAG_KEY, { borrow: [], buy: [] });
export function bagList(kind) { return bag[kind].map((k) => RECS.find((r) => keyOf(r) === k)).filter(Boolean); }
export function inBag(kind, r) { return bag[kind].includes(keyOf(r)); }
export function toggleBag(kind, r) {
  const k = keyOf(r); const i = bag[kind].indexOf(k);
  if (i >= 0) bag[kind].splice(i, 1); else bag[kind].push(k);
  save(BAG_KEY, bag); return i < 0;
}
export function clearBag(kind) { bag[kind] = []; save(BAG_KEY, bag); }

// 検索（タイトル・著者・賞の名前・回）
export let catalogVersion = 0;
function reindex() { catalogVersion++; }
reindex();
export const findRec = (t, a) => find(t, a);
// 貸出日（例：2026年9月25日）を YYYY-MM-DD にする
export function parseLoanDate(d) {
  const m = String(d || '').match(/([0-9]{4})年([0-9]{1,2})月([0-9]{1,2})日/);
  return m ? m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0') : '';
}
export const prizeCounts = () => PRIZE_ORDER.map((p) => ({ p, n: RECS.filter((r) => r.prizes.some((x) => x.p === p)).length }));

// 読みたい本（Notion「読書管理」）も検索やかばんで扱えるように、蔵書に加える
export function registerWish(items) {
  RECS.forEach((r) => { if (r.wish) r.wish = null; });
  items.forEach((it) => {
    const a = (it.authors || []).join('・');
    let rec = RECS.find((r) => r.wishIsbn === it.isbn && it.isbn) || find(it.title, a);
    if (!rec) { rec = { t: it.title, a, d: '', baseRead: false, fromLib: false, prizes: [], id: RECS.length }; RECS.push(rec); index(rec); }
    rec.wish = it; rec.wishIsbn = it.isbn;
    if (!rec.fromLib) rec.baseRead = it.status === '読了';
  });
  reindex();
}
