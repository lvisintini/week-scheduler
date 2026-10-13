// Tiny static server for the single-page app (http://localhost is a secure context, like https, so Web Crypto and the clipboard work).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(path.join(root, 'index.html'))); return; }
  res.writeHead(404); res.end('not found');
}).listen(4173, () => console.log('serving index.html on http://localhost:4173'));
