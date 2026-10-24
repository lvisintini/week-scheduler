// Tiny static server for the app, like GitHub Pages: index.html, app.css, the scripts in js/ and the pictures of How to use, nothing else
// (http://localhost is a secure context, like https, so Web Crypto and the clipboard work). `npm run serve` for local use.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const allowed = p => p === '/index.html' || p === '/app.css' || /^\/js\/[a-z0-9]+\.js$/.test(p) || /^\/img\/help\/(en|es)\/[a-z]+\.png$/.test(p);   // the app's files only
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split(/[?#]/)[0]);if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!allowed(p) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)], 'cache-control': 'no-store' }); res.end(fs.readFileSync(file));
}).listen(4173, () => console.log('serving the app on http://localhost:4173'));
