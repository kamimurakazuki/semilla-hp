# 株式会社セミーヤ コーポレートサイト

semilla-inc.com 公開用のコーポレートサイト一式。
依存パッケージなし（Node.js標準機能のみ）の静的サイト。

## 構成

```
site.config.json   会社情報・価格・サイトURL・フォーム送信先の一元管理ファイル
build.js           ビルドスクリプト（src/ → dist/ を生成）
serve.js           ローカル確認用サーバ（起動時に自動ビルド）
src/layout.html    全ページ共通レイアウト（ヘッダー・フッター・meta/OGP）
src/pages/         各ページ本文（14ページ）
src/assets/        CSS / JS / 画像
gas/contact-form.gs  お問い合わせフォーム受信用 Google Apps Script
dist/              ビルド生成物（この中身をそのままホスティングにアップロード）
```

## コマンド

サイト構成: サービス（/services/）の下に「店舗運営事業（/services/store/ アミューズメントバー運営）」と
「開発事業（/services/development/ 店舗DX）」があり、製品情報（店舗運営DX /products/store-dx/、
AI店舗分析 /products/ai-analysis/）は開発事業の配下に位置づけている。

ビルド（dist/ を生成）:

    node build.js

ローカル確認（自動ビルド + http://localhost:4649 で配信）:

    node serve.js

成功条件: 「ビルド完了: 13ページ + sitemap.xml + robots.txt」と表示され、
http://localhost:4649 でサイトが表示されること。

## 内容の更新方法

### 住所・電話・会社情報の変更（登記住所の確定時など）

1. site.config.json の company.address / company.streetAddress / company.postal 等を編集
2. `node build.js` を実行
3. dist/ を再アップロード

サイト内の住所・電話・メール・価格はすべて site.config.json から展開されるため、
個別ページの編集は不要。

### ページ文言の変更

src/pages/ 配下の該当ファイルを編集 → `node build.js`。
各ファイル冒頭の `<!--PAGE ... PAGE-->` はtitle・description・パンくず等の設定。

### 製品画面キャプチャの追加

1. 画像を src/assets/img/screens/ に配置（例: store-dx-01.png）
2. src/pages/products-store-dx.html / products-ai-analysis.html の
   「製品画面」セクション内のコメントアウトを外して編集
3. `node build.js`

### 運営店舗情報の更新

src/pages/services-store.html の「店舗情報」セクションに casa上野店 を掲載済み。
店舗を追加する場合は、同セクション内の card ブロックを複製して編集し `node build.js`。

## お問い合わせフォームの本番設定（公開前に必須）

現在 site.config.json の contactFormEndpoint は空。
このままでも localhost ではモックAPIで動作確認できるが、
本番では送信エラーになるため、公開前に以下を必ず実施する。

1. gas/contact-form.gs の冒頭コメントの手順どおり、Google Apps Script をウェブアプリとしてデプロイ
2. 発行されたURLを site.config.json の "contactFormEndpoint" に設定
3. `node build.js` → dist/ を再アップロード

動作確認コマンド:

    curl -s -X POST -H "Content-Type: text/plain;charset=utf-8" \
      -d '{"name":"テスト太郎","email":"test@example.com","type":"その他","message":"送信テストです","elapsedMs":10000,"website":""}' \
      "＜GASウェブアプリのURL＞"

成功条件: {"ok":true} が返り、kamimura@semilla-inc.com に通知メールが届くこと。

ログ確認方法: Apps Script エディタの「実行数」メニューで doPost の実行履歴・エラーを確認。

スパム対策: honeypot欄 + 送信までの最短時間チェック（3秒）をフォーム側とGAS側の両方で実施。

## 公開

正式URL（canonical）: https://semilla-inc.com/ （独自ドメイン・Railway配信）
ミラー: https://kamimurakazuki.github.io/semilla-hp/ （GitHub Pages・移行期間中のみ）
リポジトリ: https://github.com/kamimurakazuki/semilla-hp （public）

main ブランチに push すると GitHub Actions が GitHub Pages 版を自動更新する。
Railway は GitHub リポジトリ連携で、push のたびに自動ビルド・自動デプロイされる。

更新の流れ:

    node serve.js      # ローカルで確認
    git add -A && git commit -m "変更内容"
    git push           # ← push で GitHub Pages / Railway 両方に自動反映

### Railway 構成

- ビルド: node build.js（railway.json の buildCommand。環境変数は不要）
- 配信: node server.js（PORT は Railway が自動注入）
- server.js の機能: dist/ 配信、末尾スラッシュ301、www→apex 301、
  http→https 301、404.html、gzip、キャッシュ/セキュリティヘッダー
- ローカルでの本番同等確認: node build.js && node server.js → http://localhost:8080/

### Railway 初回セットアップ（ダッシュボード操作）

1. https://railway.app → New Project → Deploy from GitHub repo → kamimurakazuki/semilla-hp
   （railway.json を自動検出してビルド・起動する）
2. Service → Settings → Networking → Generate Domain で確認用URL（*.up.railway.app）を発行
3. 表示確認後、Custom Domain に semilla-inc.com と www.semilla-inc.com を追加
   → それぞれに表示される CNAME 先の値を控えて DNS に設定する

### DNS 設定（お名前.com / semilla-inc.com）

現状: ネームサーバー = dnsv.jp（お名前.com）、apex/www の Web 用レコードは未設定。

Railway は apex ドメインに固定 A レコードを提供しないため、apex（semilla-inc.com）を
メインにする場合は CNAME Flattening 対応の DNS（Cloudflare 無料プラン等）への
ネームサーバー変更が必要（お名前.com標準DNSは apex の CNAME/ALIAS 非対応）。

【重要】DNS変更時の注意（メールを止めないこと）:
- MX 1 smtp.google.com（Google Workspace のメール）と
  TXT google-site-verification=... は必ず引き継ぐ・削除しないこと。
  追加・変更するのは Web 用（CNAME）のみ。

### GitHub Pages の扱い（独自ドメイン公開後）

canonical / OGP / sitemap は https://semilla-inc.com に統一済みのため、
GitHub Pages 版が残っていても検索上の正式URLは独自ドメインになる。
独自ドメインでの表示確認後、GitHub Pages は停止してよい
（リポジトリ Settings → Pages → Source を None に変更。リポジトリ自体は残す）。

## 公開前チェックリスト

- [ ] 最新の登記事項証明書と本店所在地・商号・代表者名を照合（site.config.json）
- [ ] 郵便番号 150-0021 が正しいか確認
- [ ] contactFormEndpoint にGASのURLを設定し、実送信テスト
- [ ] site.config.json の site.url が実際の公開ドメインと一致しているか確認
- [ ] プライバシーポリシー・利用規約の制定日を公開日に合わせるか確認
- [ ] 英文表記「SEMILLA Inc.」の使用可否を確認（ヘッダー・OGP画像・構造化データで使用）
