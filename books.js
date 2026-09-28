// 蔵書データと「読んだ」印の管理
import READ_BOOKS from './data/read-books.json';

// 借りるボタンの行き先（葛飾区立図書館）。jsessionid を含む URL は時間が経つと切れることがあるので、
// 切れていたらここを書き換える。
export const BORROW_URL = 'https://www.lib.city.katsushika.lg.jp/contents;jsessionid=62E42934AFD896BEA336F5CF585876C6?0&pid=323';
export const amazonUrl = (title, author) => 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(title + ' ' + author);

export const UNREAD_BOOKS = [['サピエンス全史','ユヴァル・ノア・ハラリ'],['ファスト＆スロー','ダニエル・カーネマン'],['銃・病原菌・鉄','ジャレド・ダイアモンド'],['イノベーションのジレンマ','クレイトン・クリステンセン'],['ビジョナリー・カンパニー','ジム・コリンズ'],['利己的な遺伝子','リチャード・ドーキンス'],['コスモス','カール・セーガン'],['夜と霧','ヴィクトール・E・フランクル'],['予想どおりに不合理','ダン・アリエリー'],['ブラック・スワン','ナシーム・ニコラス・タレブ'],['競争の戦略','マイケル・E・ポーター'],['統計学が最強の学問である','西内啓'],['影響力の武器','ロバート・B・チャルディーニ'],['FACTFULNESS','ハンス・ロスリング'],['ホモ・デウス','ユヴァル・ノア・ハラリ'],['エッセンシャル思考','グレッグ・マキューン'],['イシューからはじめよ','安宅和人'],['思考の整理学','外山滋比古'],['重力とは何か','大栗博司'],['時間は存在しない','カルロ・ロヴェッリ']];

export { READ_BOOKS };
export const RECS = READ_BOOKS.map((b) => ({ t: b[0], a: b[1], d: b[2], fromLib: true }))
  .concat(UNREAD_BOOKS.map((b) => ({ t: b[0], a: b[1], d: '', fromLib: false })));

// 自分でつけた「読んだ」印（ブラウザに保存）
const KEY = 'my-library:marks:v1';
let marks = {};
try { marks = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { marks = {}; }
const keyOf = (r) => r.t + '|' + r.a;
export function isRead(r) { const m = marks[keyOf(r)]; return m === undefined ? r.fromLib : m; }
export function setRead(r, v) {
  const k = keyOf(r);
  if (v === r.fromLib) delete marks[k]; else marks[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch (_) {}
}
export const readCount = () => RECS.filter(isRead).length;

export const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[\s・\-－―「」『』()（）:：、。!！?？]/g, '');
const IDX = RECS.map((r) => norm(r.t + ' ' + r.a));
export function searchBooks(q, limit = 60) {
  const n = norm(q); if (!n) return [];
  const hits = []; for (let i = 0; i < RECS.length && hits.length < limit; i++) if (IDX[i].includes(n)) hits.push(i);
  return hits;
}
