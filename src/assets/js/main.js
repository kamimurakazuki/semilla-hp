// モバイルメニュー開閉
(function () {
  var btn = document.querySelector('.menu-toggle');
  var nav = document.getElementById('global-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();
