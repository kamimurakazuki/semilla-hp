// お問い合わせフォーム送信処理
// 送信先はフォームの data-endpoint 属性（site.config.json の contactFormEndpoint）。
// 未設定の場合、localhost ではモックAPI（/api/mock-contact）に送信して動作確認できる。
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  var loadedAt = Date.now();
  var success = document.getElementById('form-success');
  var failure = document.getElementById('form-error');
  var submitBtn = document.getElementById('form-submit');

  function endpoint() {
    var ep = form.getAttribute('data-endpoint');
    if (ep) return ep;
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return '/api/mock-contact';
    return '';
  }

  // 送信先未設定（本番でGAS URL未設定）の場合はフォームを隠し、準備中の案内を表示
  if (!endpoint()) {
    form.hidden = true;
    var unavailable = document.getElementById('form-unavailable');
    if (unavailable) unavailable.hidden = false;
    return;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    failure.hidden = true;
    if (!form.reportValidity()) return;

    var f = form.elements;
    var data = {
      company: f['company'].value.trim(),
      name: f['name'].value.trim(),
      email: f['email'].value.trim(),
      tel: f['tel'].value.trim(),
      type: f['type'].value,
      message: f['message'].value.trim(),
      website: f['website'].value, // honeypot（人間には見えない欄。値があればbot）
      elapsedMs: Date.now() - loadedAt,
      page: location.href
    };

    // honeypot に入力があった場合は送信せずに成功表示のみ（botを静かに落とす）
    if (data.website) {
      form.hidden = true;
      success.hidden = false;
      return;
    }

    var ep = endpoint();
    if (!ep) {
      failure.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          form.hidden = true;
          success.hidden = false;
          success.setAttribute('tabindex', '-1');
          success.focus();
        } else {
          throw new Error('send failed');
        }
      })
      .catch(function () {
        failure.hidden = false;
        submitBtn.disabled = false;
      });
  });
})();
