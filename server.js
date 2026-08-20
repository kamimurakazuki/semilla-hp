// 本番用 静的ファイルサーバー（Railway向け・依存パッケージなし）
//
// 役割:
//   - dist/ を配信（/services/store/ のようなディレクトリURLは index.html を返す）
//   - 末尾スラッシュなしのディレクトリURLは 301 でスラッシュ付きへ
//   - www.ドメイン → apexドメイン へ 301 リダイレクト
//   - x-forwarded-proto: http → https へ 301 リダイレクト
//   - 存在しないURLは 404.html を 404 ステータスで返す
//
// 起動: node server.js（PORT は環境変数 PORT、未設定時 8080）
// ローカル確認: node build.js && node server.js → http://localhost:8080/

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 8080;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf'
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg']);

function cacheControl(ext) {
  if (ext === '.html' || ext === '.xml' || ext === '.txt' || ext === '.json') return 'no-cache';
  if (ext === '.css' || ext === '.js') return 'public, max-age=3600';
  return 'public, max-age=86400';
}

function baseHeaders(req) {
  const h = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
  if (req.headers['x-forwarded-proto'] === 'https') {
    h['Strict-Transport-Security'] = 'max-age=31536000';
  }
  return h;
}

function redirect(res, req, location) {
  res.writeHead(301, Object.assign(baseHeaders(req), {
    Location: location,
    'Cache-Control': 'no-cache',
    'Content-Length': 0
  }));
  res.end();
}

function sendFile(req, res, filePath, status) {
  const ext = path.extname(filePath).toLowerCase();
  let body = fs.readFileSync(filePath);
  const headers = Object.assign(baseHeaders(req), {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cacheControl(ext)
  });
  const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  if (acceptsGzip && COMPRESSIBLE.has(ext) && body.length > 1024) {
    body = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  res.end(body);
}

function send404(req, res) {
  const page = path.join(DIST, '404.html');
  if (fs.existsSync(page)) { sendFile(req, res, page, 404); return; }
  res.writeHead(404, Object.assign(baseHeaders(req), { 'Content-Type': 'text/plain; charset=utf-8' }));
  res.end('404 Not Found');
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const rawHost = String(req.headers.host || '').toLowerCase();
  const host = rawHost.split(':')[0];

  // www → apex（例: www.semilla-inc.com → semilla-inc.com）
  if (host.startsWith('www.')) {
    redirect(res, req, 'https://' + host.slice(4) + req.url);
    return;
  }
  // http → https（プロキシ経由のアクセスのみ。ローカル直アクセスは対象外）
  if (req.headers['x-forwarded-proto'] === 'http') {
    redirect(res, req, 'https://' + host + req.url);
    return;
  }

  let pathname;
  let search = '';
  try {
    const u = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(u.pathname);
    search = u.search || '';
  } catch (e) {
    send404(req, res);
    return;
  }
  if (pathname.includes('\0')) { send404(req, res); return; }

  const filePath = path.normalize(path.join(DIST, pathname));
  if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) {
    send404(req, res);
    return;
  }

  try {
    if (pathname.endsWith('/')) {
      const index = path.join(filePath, 'index.html');
      if (fs.existsSync(index)) { sendFile(req, res, index, 200); return; }
      send404(req, res);
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      redirect(res, req, pathname + '/' + search);
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(req, res, filePath, 200);
      return;
    }
    send404(req, res);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('semilla-hp server: http://0.0.0.0:' + PORT + ' （配信ディレクトリ: ' + DIST + '）');
});
