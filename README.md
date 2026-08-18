# 株式会社セミーヤ コーポレートサイト

semilla-inc.com 公開用のコーポレートサイト一式。
依存パッケージなし（Node.js標準機能のみ）の静的サイト。

## 構成

```
site.config.json   会社情報・価格・サイトURL・フォーム送信先の一元管理ファイル
build.js           ビルドスクリプト（src/ → dist/ を生成）
serve.js           ローカル確認用サーバ（起動時に自動ビルド）
src/layout.html    全ページ共通レイアウト（ヘッダー・フッター・meta/OGP）
src/pages/         各ページ本文（13ページ）
src/assets/        CSS / JS / 画像
gas/contact-form.gs  お問い合わせフォーム受信用 Google Apps Script
dist/              ビルド生成物（この中身をそのままホスティングにアップロード）
```

## コマンド

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

1. 画像を src/assets/img/screens/ に配置（例: casa-dx-01.png）
2. src/pages/products-casa-dx.html / products-casa-ai.html の
   「製品画面」セクション内のコメントアウトを外して編集
3. `node build.js`

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

## 公開手順（推奨: Cloudflare Pages）

1. https://dash.cloudflare.com で Pages プロジェクトを作成（無料プラン可）
   「Upload assets」方式で dist/ の中身をアップロードするのが最も簡単
2. カスタムドメイン semilla-inc.com / www.semilla-inc.com を追加
3. DNS設定（現在 dnsv.jp = お名前.com系で管理）で、Pagesの指示に従い
   CNAME等のレコードを追加する

【重要】DNS変更時の注意:
- MXレコード（smtp.google.com = Google Workspaceのメール）と
  TXTレコード（google-site-verification）は絶対に削除・変更しないこと。
  変更するのはWeb用（A / AAAA / CNAME）のみ。
- SSLはCloudflare Pagesが自動発行する。

## 公開前チェックリスト

- [ ] 最新の登記事項証明書と本店所在地・商号・代表者名を照合（site.config.json）
- [ ] 郵便番号 150-0021 が正しいか確認
- [ ] contactFormEndpoint にGASのURLを設定し、実送信テスト
- [ ] site.config.json の site.url が実際の公開ドメインと一致しているか確認
- [ ] プライバシーポリシー・利用規約の制定日を公開日に合わせるか確認
- [ ] 英文表記「SEMILLA Inc.」の使用可否を確認（ヘッダー・OGP画像・構造化データで使用）
