# My Library

竜の飛ぶ国の大図書館を、ブラウザの中で歩くための個人用Webアプリ。

- ヴォールト天井のギャラリーを一人称で歩き、背表紙をタップして本を棚から取り出す
- 西の壁：葛飾区立図書館の貸出履歴（CSV）と未読の本。東の壁：Notion「小説作成賞」DBの文学賞受賞作（賞ごと、新しい回から）
- 本を「借りる本／買う本」としてかばんに入れ、入口の貸出カウンター（司書）・購入カウンター（行商人）へ持っていく
- 検索は書名・著者のほか「芥川賞」「直木賞 170」など賞や回でも。選ぶとその棚へ一瞬で移動
- 本屋さんで本の裏のバーコード（978〜）をスマホで読むと、Notion「読書管理」に保存され、館内の「読みたい本の台」に表紙を上にして積み重なる
- 時刻・天気（晴れ・くもり・雨・雪・雷）が移ろい、館内では賢者や学僧が本を探し、中庭では騎士や魔導士が動く

## 動かす

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## ファイル

```
index.html / style.css   画面（HUD・検索・本のシート・カウンター）
main.js                  3D空間、時間と天気、操作、本の配置・取り出し・検索・移動
characters.js            登場人物の読み込みとアニメーション再生
people.js                人々のふるまい（歩く・座って読む・詠唱・剣戟・衛兵・係）
counters.js              貸出・購入カウンター（家具・近づいたときの案内・パネル）
scanner.js               バーコード読み取り（Android は BarcodeDetector、iPhone は ZXing）
wishlist.js              読みたい本リスト（Notion と同期、つながらないときは端末に保存）
wishpile.js              読みたい本の台（3D）
spines.js                背表紙の書名（縦書きのテクスチャアトラス）
figures.js               竜
textures.js              天井画・壁画・薔薇窓などを canvas で描くテクスチャ
books.js                 蔵書のまとめ（貸出履歴＋文学賞）、読んだ印、かばん、検索
read-books.json          貸出履歴（import-csv.mjs で更新）
prize-books.json         文学賞の蔵書（Notion から作った初期データ）
models/                  登場人物の3Dモデル（KayKit Adventurers／CC0）
api/books.js             Notion と公式発表から最新の蔵書を返す
api/cron-prizes.js       毎日、芥川賞・直木賞の最新受賞作を Notion に追加する
api/isbn.js              ISBN から書誌を調べる（openBD → Google Books → 国立国会図書館）
api/cover.js             表紙画像を同じドメインから配る
api/bookinfo.js          本の紹介（Google Books で特定し、openBD の内容紹介で補う）
api/wishlist.js          Notion「読書管理」の読み書き
vercel.json              上の定期実行の設定（毎朝7時・日本時間）
```

## Notion との連携（Vercel の環境変数）

| 名前 | 中身 |
|---|---|
| `NOTION_TOKEN` | Notion インテグレーションのシークレット |
| `GOOGLE_BOOKS_API_KEY` | 省略可。Google Books API のキー。なくても動くが、回数制限にかかりにくくなる |
| `APP_PASSCODE` | 任意の合言葉。読みたい本の追加・変更のときに一度だけ聞かれる |
| `CRON_SECRET` | 任意の長い文字列（定期実行を他人に叩かれないため） |
| `NOTION_DATA_SOURCE_ID` | 省略可。既定は「小説作成賞」DB |

Notion のインテグレーションは「小説作成賞」と「読みたい本リスト」（読書管理）の両方に接続する。

`NOTION_TOKEN` がなくても、同梱の `prize-books.json` と公式発表の最新回で動く。

## 貸出履歴を更新する

```bash
npm run import-csv -- ~/Downloads/RENTHIS20260927.csv
```

## クレジット

登場人物：KayKit Character Pack Adventures（Kay Lousberg, CC0）
