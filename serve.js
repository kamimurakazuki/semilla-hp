#!/usr/bin/env node
/*
 * serve.js — ローカル確認用サーバ（依存パッケージなし）
 *
 *   実行:  node serve.js
 *   URL:   http://localhost:4649
 *
 * 起動時に build.js を実行してから dist/ を配信する。
 * お問い合わせフォームの動作確認用に、モックAPI POST /api/mock-contact を備える
 * （本番では Google Apps Script のURLを site.config.json に設定して使う）。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PORT = Number(process.env.PORT || 4649);
const DIST = path.join(__dirname, 'dist');

// 起動時にビルド
const r = spawnSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}

function sendFile(res, filePath, status) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(status || 200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  // ---- モックお問い合わせAPI（ローカル確認用） ----
  if (req.method === 'POST' && req.url === '/api/mock-contact') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const d = JSON.parse(body);
        if (d.website) return sendJson(res, 200, { ok: true, note: 'honeypot' });
        if (!d.name || !d.email || !d.message) return sendJson(res, 400, { ok: false, error: 'required' });
        if (typeof d.elapsedMs === 'number' && d.elapsedMs < 3000) return sendJson(res, 400, { ok: false, error: 'too_fast' });
        console.log('[mock-contact] 受信:', JSON.stringify({
          name: d.name, company: d.company, email: d.email, tel: d.tel, type: d.type,
          message: String(d.message).slice(0, 200), elapsedMs: d.elapsedMs
        }));
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: 'invalid_json' });
      }
    });
    return;
  }

  // ---- 開発用: OGP画像保存（ローカル専用・保存先固定） ----
  if (req.method === 'POST' && req.url === '/api/dev-save-ogp') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 3 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const b64 = body.replace(/^data:image\/png;base64,/, '');
        const buf = Buffer.from(b64, 'base64');
        if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) {
          return sendJson(res, 400, { ok: false, error: 'not_png' });
        }
        const out = path.join(__dirname, 'src', 'assets', 'img', 'ogp.png');
        fs.writeFileSync(out, buf);
        console.log('[dev-save-ogp] 保存: ' + out + ' (' + buf.length + ' bytes)');
        return sendJson(res, 200, { ok: true, bytes: buf.length });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: 'invalid' });
      }
    });
    return;
  }

  // ---- 静的ファイル配信 ----
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400).end('Bad Request');
    return;
  }
  if (urlPath.includes('..')) {
    res.writeHead(400).end('Bad Request');
    return;
  }

  let filePath = path.join(DIST, urlPath);
  if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!path.extname(filePath) && fs.existsSync(filePath + '/index.html')) {
    filePath = filePath + '/index.html';
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath);
  } else {
    const notFound = path.join(DIST, '404.html');
    if (fs.existsSync(notFound)) sendFile(res, notFound, 404);
    else res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('ローカルサーバ起動: http://localhost:' + PORT);
  console.log('停止: Ctrl+C');
});
