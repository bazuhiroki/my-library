# My Library

竜の飛ぶ国の大図書館を、ブラウザの中で歩くための個人用Webアプリ。

- 長いヴォールト天井のギャラリーを一人称で歩き、背表紙をタップして本を棚から取り出す
- 本ごとに「図書館で借りる」（葛飾区立図書館）と「Amazonで買う」へ移動できる
- 葛飾区立図書館の貸出履歴CSVから取り込んだ本には金のラベルが付く。ラベルは自分で付け外しもできる（ブラウザに保存）
- 右上の虫めがね（PCは `/` キー）で検索し、選ぶとその棚まで一瞬で移動する
- 時刻と天気が移ろう（晴れ・くもり・雨・雪、昼夜、雷）。窓の外には騎士や魔導士、空には竜

## 動かす

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に書き出し
```

## 操作

| | スマホ | PC |
|---|---|---|
| 歩く | 画面左下をなぞる | WASD / ↑↓ |
| 見回す | 画面をドラッグ | ドラッグ / ←→ |
| 走る | — | Shift |
| 本を取る | 背表紙をタップ | 背表紙をクリック |
| 探す | 右上の虫めがね | `/` または Ctrl+K |

## 貸出履歴を更新する

葛飾区立図書館のマイページから書き出した `RENTHIS*.csv` を取り込む。

```bash
npm run import-csv -- ~/Downloads/RENTHIS20260927.csv
```

`src/data/read-books.json` が書き換わるので、コミットしてプッシュすれば Vercel に反映される。

## デプロイ（Vercel）

Vercel で「Add New → Project」からこのリポジトリを選ぶ。Framework Preset は Vite が自動で選ばれ、ビルドコマンド `npm run build`、出力先 `dist` のままでよい。

## 構成

```
index.html            画面のHTML（HUD・検索・本のシート）
src/main.js           3D空間の組み立て、時間と天気、操作、本の取り出し・検索・移動
src/figures.js        司祭・賢者・騎士・魔導士・剣士と竜
src/textures.js       天井画・壁画・薔薇窓などを canvas で描くテクスチャ
src/books.js          蔵書データ、読んだ印（localStorage）、検索
src/data/read-books.json  貸出履歴から作った蔵書リスト
scripts/import-csv.mjs    CSV → JSON 変換
```

## メモ

- 借りるボタンの URL は `src/books.js` の `BORROW_URL`。`jsessionid` 入りの URL は時間が経つと切れることがあるので、切れたら差し替える。
- three.js は r128 に固定している。
