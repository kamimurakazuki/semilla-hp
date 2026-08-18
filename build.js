#!/usr/bin/env node
/*
 * build.js — 株式会社セミーヤ コーポレートサイト 静的ビルドスクリプト
 *
 * 依存パッケージなし（Node.js 標準機能のみ）。
 *   実行:      node build.js
 *   入力:      site.config.json / src/layout.html / src/pages/*.html / src/assets/
 *   出力:      dist/
 *
 * 会社情報（住所・電話・価格等）は site.config.json に一元管理し、
 * ページ内の {{company.address}} などのプレースホルダに展開する。
 * 登記住所の変更時は site.config.json を編集して再ビルドするだけでよい。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const PAGES = path.join(SRC, 'pages');
const DIST = path.join(ROOT, 'dist');

// ------------------------------------------------------------
// 設定読み込み・フラット化（{ company: { name: X } } → "company.name": X）
// ------------------------------------------------------------
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

// デプロイ先に応じた上書き（GitHub Pages等のサブパス配信用）
//   SITE_URL=https://example.github.io/repo BASE_PATH=/repo node build.js
if (process.env.SITE_URL) config.site.url = process.env.SITE_URL;
const BASE_PATH = process.env.BASE_PATH || '';

function flatten(obj, prefix, out) {
  out = out || {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const name = prefix ? prefix + '.' + key : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flatten(val, name, out);
    } else {
      out[name] = String(val);
    }
  }
  return out;
}
const VARS = flatten(config);

// ------------------------------------------------------------
// グローバルナビゲーション定義
// ------------------------------------------------------------
const NAV = [
  { label: '会社情報', href: '/company/', group: 'company' },
  {
    label: 'サービス', href: '/services/', group: 'services',
    sub: [
      { label: '店舗運営事業', href: '/services/store/' },
      { label: '開発事業（店舗DX）', href: '/services/development/' },
      { label: '店舗運営DX', href: '/products/store-dx/' },
      { label: 'AI店舗分析', href: '/products/ai-analysis/' },
      { label: '導入の流れ', href: '/flow/' },
      { label: '料金', href: '/pricing/' }
    ]
  },
  { label: 'FAQ', href: '/faq/', group: 'faq' },
  { label: 'お問い合わせ', href: '/contact/', group: 'contact', cta: true }
];

function navHtml(activeGroup) {
  const items = NAV.map((item) => {
    const cls = [];
    if (item.sub) cls.push('has-sub');
    if (item.cta) cls.push('nav-cta');
    if (item.group === activeGroup) cls.push('is-active');
    const liClass = cls.length ? ' class="' + cls.join(' ') + '"' : '';
    const current = item.group === activeGroup ? ' aria-current="page"' : '';
    let html = '      <li' + liClass + '><a href="' + item.href + '"' + current + '>' + item.label + '</a>';
    if (item.sub) {
      html += '\n        <ul class="nav-sub">\n';
      html += item.sub.map((s) => '          <li><a href="' + s.href + '">' + s.label + '</a></li>').join('\n');
      html += '\n        </ul>\n      ';
    }
    html += '</li>';
    return html;
  });
  return '      <ul class="nav-list">\n' + items.join('\n') + '\n      </ul>';
}

// ------------------------------------------------------------
// パンくず（表示用HTML + 構造化データ）
// ------------------------------------------------------------
function pageheadHtml(meta) {
  if (!meta.breadcrumb) return '';
  const items = meta.breadcrumb
    .map(([label, href]) => (href ? '<li><a href="' + href + '">' + label + '</a></li>' : '<li aria-current="page">' + label + '</li>'))
    .join('');
  return (
    '<div class="page-head">\n  <div class="container">\n' +
    '    <nav aria-label="現在位置"><ol class="breadcrumb">' + items + '</ol></nav>\n' +
    '    <h1>' + meta.heading + '</h1>\n' +
    '  </div>\n</div>'
  );
}

function breadcrumbJsonld(meta) {
  if (!meta.breadcrumb) return '';
  const elements = meta.breadcrumb.map(([label, href], i) => {
    const el = { '@type': 'ListItem', position: i + 1, name: label };
    if (href) el.item = config.site.url + href;
    return el;
  });
  const data = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: elements };
  return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>\n';
}

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function replaceVars(text, vars) {
  return text.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key];
    return m; // 未知のキーは残して後で検出
  });
}

function copyDir(from, to) {
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

// ------------------------------------------------------------
// ビルド本体
// ------------------------------------------------------------
function build() {
  const layout = fs.readFileSync(path.join(SRC, 'layout.html'), 'utf8');

  // dist を作り直す（dist はビルド生成物専用ディレクトリ）
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  const pageFiles = fs.readdirSync(PAGES).filter((f) => f.endsWith('.html')).sort();
  const sitemapEntries = [];
  const problems = [];
  let count = 0;

  for (const file of pageFiles) {
    const raw = fs.readFileSync(path.join(PAGES, file), 'utf8');
    const m = raw.match(/<!--PAGE([\s\S]*?)PAGE-->/);
    if (!m) {
      problems.push(file + ': メタ情報（<!--PAGE ... PAGE-->）がありません');
      continue;
    }
    let meta;
    try {
      meta = JSON.parse(m[1]);
    } catch (e) {
      problems.push(file + ': メタ情報のJSONが不正です — ' + e.message);
      continue;
    }
    const content = raw.slice(m.index + m[0].length).trim();

    const pageUrl = config.site.url + meta.path;
    const scripts = (meta.scripts || [])
      .map((s) => '<script src="' + s + '" defer></script>')
      .join('\n');

    const pageVars = Object.assign({}, VARS, {
      content: content,
      nav: navHtml(meta.navGroup || ''),
      pagehead: pageheadHtml(meta),
      'page.title': meta.title,
      'page.description': meta.description || '',
      'page.url': pageUrl,
      'page.ogType': meta.ogType || 'website',
      'page.robots': meta.noindex ? '<meta name="robots" content="noindex">\n' : '',
      'page.scripts': scripts ? scripts + '\n' : '',
      'page.jsonld': breadcrumbJsonld(meta)
    });

    // プレースホルダ展開（content 内にも {{...}} があるため2回実施）
    let html = replaceVars(layout, pageVars);
    html = replaceVars(html, pageVars);

    // 未解決プレースホルダの検出（ビルド失敗として扱う）
    const leftover = html.match(/\{\{[a-zA-Z0-9_.-]+\}\}/g);
    if (leftover) {
      problems.push(file + ': 未解決のプレースホルダ — ' + [...new Set(leftover)].join(', '));
      continue;
    }

    // サブパス配信時はルート相対リンクにベースパスを付与
    if (BASE_PATH) {
      html = html.replace(/(href|src)="\/(?!\/)/g, '$1="' + BASE_PATH + '/');
    }

    // 出力先: "/company/" → dist/company/index.html、"/404.html" → dist/404.html
    const outRel = meta.path.endsWith('/') ? meta.path + 'index.html' : meta.path;
    const outPath = path.join(DIST, outRel.replace(/^\//, ''));
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, html);
    count++;

    if (!meta.noindex) sitemapEntries.push(pageUrl);
  }

  if (problems.length) {
    console.error('ビルドエラー:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }

  // アセットコピー
  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'));

  // ルート直下に置くファビコン類
  const rootCopies = [
    ['assets/img/favicon.svg', 'favicon.svg'],
    ['assets/img/favicon-32.png', 'favicon.png'],
    ['assets/img/apple-touch-icon.png', 'apple-touch-icon.png']
  ];
  for (const [from, to] of rootCopies) {
    const src = path.join(DIST, from);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, to));
    else console.warn('注意: ' + from + ' が見つからないため ' + to + ' を配置できません');
  }

  // sitemap.xml
  const today = new Date().toISOString().slice(0, 10);
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapEntries
      .map((u) => '  <url><loc>' + u + '</loc><lastmod>' + today + '</lastmod></url>')
      .join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

  // robots.txt
  fs.writeFileSync(
    path.join(DIST, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: ' + config.site.url + '/sitemap.xml\n'
  );

  const mode = BASE_PATH ? '（BASE_PATH=' + BASE_PATH + '）' : '';
  console.log('ビルド完了: ' + count + 'ページ + sitemap.xml + robots.txt → ' + DIST + mode);
}

build();
