/*
 * contact-form.gs — お問い合わせフォーム受信用 Google Apps Script
 *
 * 【役割】
 *   サイトのお問い合わせフォームからのPOSTを受信し、
 *   スパムチェックのうえ、CONFIG.TO_EMAIL にメール通知する。
 *   （任意で記録用スプレッドシートにも追記できる）
 *
 * 【設置手順】
 *   1. https://script.new を開く（kamimura@semilla-inc.com のGoogleアカウントで）
 *   2. このファイルの内容をすべて貼り付けて保存（プロジェクト名例: semilla-contact-form）
 *   3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *        - 実行ユーザー: 自分
 *        - アクセスできるユーザー: 全員
 *   4. 発行された「ウェブアプリのURL」（https://script.google.com/macros/s/...../exec）をコピー
 *   5. サイト側 site.config.json の "contactFormEndpoint" にそのURLを設定し、node build.js で再ビルド
 *
 * 【動作確認コマンド（ターミナルから）】
 *   curl -s -X POST -H "Content-Type: text/plain;charset=utf-8" \
 *     -d '{"name":"テスト太郎","email":"test@example.com","type":"その他","message":"送信テストです","elapsedMs":10000,"website":""}' \
 *     "＜ウェブアプリのURL＞"
 *   → {"ok":true} が返り、TO_EMAIL宛に通知メールが届けば成功
 *
 * 【ログ確認方法】
 *   Apps Script エディタ左メニュー「実行数」で doPost の実行履歴とエラーを確認できる。
 *   スプレッドシート記録を有効にした場合は、シートに1行ずつ追記される。
 */

var CONFIG = {
  TO_EMAIL: 'kamimura@semilla-inc.com',   // 通知先メールアドレス
  SUBJECT_PREFIX: '【semilla-inc.com】お問い合わせ：',
  MIN_ELAPSED_MS: 3000,                    // ページ表示から送信までの最短時間（bot対策）
  MAX_LEN: 5000,                           // 各項目の最大文字数
  SHEET_ID: ''                             // 任意: 記録用スプレッドシートのID（空なら記録しない）
};

function doPost(e) {
  try {
    var d = {};
    if (e && e.postData && e.postData.contents) {
      d = JSON.parse(e.postData.contents);
    }

    // --- スパム対策 ---
    // honeypot（人間には見えない欄）に値がある場合はbotとみなし、成功を装って破棄
    if (d.website) {
      return json_({ ok: true });
    }
    // ページ表示から送信までが速すぎる場合は拒否
    if (typeof d.elapsedMs === 'number' && d.elapsedMs < CONFIG.MIN_ELAPSED_MS) {
      return json_({ ok: false, error: 'invalid' });
    }

    // --- 入力チェック ---
    var name = clip_(d.name);
    var email = clip_(d.email);
    var message = clip_(d.message);
    var company = clip_(d.company);
    var tel = clip_(d.tel);
    var type = clip_(d.type);
    if (!name || !email || !message) {
      return json_({ ok: false, error: 'required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, error: 'email' });
    }

    // --- メール通知 ---
    var body = [
      'ウェブサイトのお問い合わせフォームから送信がありました。',
      '',
      '■ お問い合わせ種別: ' + (type || '（未選択）'),
      '■ 会社名・店舗名: ' + (company || '（未入力）'),
      '■ お名前: ' + name,
      '■ メールアドレス: ' + email,
      '■ 電話番号: ' + (tel || '（未入力）'),
      '',
      '■ お問い合わせ内容:',
      message,
      '',
      '---',
      '送信元ページ: ' + (d.page || '不明'),
      '受信日時: ' + new Date().toLocaleString('ja-JP')
    ].join('\n');

    MailApp.sendEmail({
      to: CONFIG.TO_EMAIL,
      replyTo: email,
      subject: CONFIG.SUBJECT_PREFIX + (type || 'お問い合わせ'),
      body: body
    });

    // --- 任意: スプレッドシートへの記録 ---
    if (CONFIG.SHEET_ID) {
      try {
        var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheets()[0];
        sheet.appendRow([new Date(), type, company, name, email, tel, message, d.page || '']);
      } catch (sheetErr) {
        // 記録失敗は通知メール送信の成否に影響させない
      }
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

function clip_(v) {
  return v ? String(v).slice(0, CONFIG.MAX_LEN).trim() : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
