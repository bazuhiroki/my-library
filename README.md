# My Library

自分だけの「歩ける3Dの世界」。図書館を中心に、映画館・映画博物館・運動場・心の部屋（湖のほとりの庵）・SixTONES館があり、本・動画・映画・運動・心の記録が Notion にたまっていきます。

- 公開URL：https://my-library-seven-alpha.vercel.app
- 構成：Vite + 素の JavaScript + Three.js（画面）／Vercel の関数（`api/`）／Notion（データ）

## 動かし方

```
npm install
npm run dev      # 手元で確認
npx vite build   # 本番と同じ組み立て
```

GitHub の `main` に push すると、Vercel が自動で組み立てて公開します（`vercel.json` の rewrites と crons もそのまま使われます）。

## ファイルの見取り図

| ファイル | 役割 |
| --- | --- |
| `main.js` | 入口。描画・プレイヤー・入力・各施設の呼び出し |
| `world.js` / `mapui.js` / `places.js` | 建物と歩ける範囲・地図とワープ・場所ごとの表示切り替え |
| `cinema.js` / `museum.js` / `sports.js` / `run.js` | 映画館・映画博物館・運動場・GPSランニング |
| `mind.js` / `elf.js` | 心の部屋（エルフとのリフレーミング）・エルフ |
| `stones.js` | SixTONES館 |
| `factory.js` / `api/_factory.js` | My Factory（工場長ドワーフ・作業台・計画・全体像・記録、朝のメール） |
| `perf.js` | 快適さの管理（画質の自動調整・省エネ・遠くの施設を描かない） |
| `meter.js` / `counters.js` / `feature.js` / `libstatus.js` ほか | 図書館の本・カウンター・特集・利用状況 |
| `api/meter-notion.js` | サーバーの窓口。`?mode=` で `api/_*.js` に振り分け（Vercel 無料プランの関数12個の上限のため） |

## 環境変数（Vercel に設定。値はここに書かない）

`NOTION_TOKEN`、`CALIL_APPKEY`、`KATSUSHIKA_LIB_ID`、`KATSUSHIKA_LIB_PASS`、`TMDB_API_KEY`、`GEMINI_API_KEY`、（任意）`ELEVENLABS_API_KEY`・`ELEVEN_VOICE_ID`、（任意）`GMAIL_USER`・`GMAIL_APP_PASSWORD`（朝の生産計画メール）、`APP_PASSCODE`

## 費用の上限

心の部屋のAI（Gemini）とエルフの声（ElevenLabs）は、Notion「AI利用量」に月ごとの使用量を記録し、合計450円・声9,000文字で自動停止します。
