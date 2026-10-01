#!/usr/bin/env node
/**
 * Static server for the Angular application-builder output (dist/browser) with SPA fallback,
 * gzip Content-Encoding for JS/CSS/HTML (so CDP encodedDataLength is the gzip transfer size) and
 * Cache-Control: no-store. Bound to 127.0.0.1.
 *
 * Standalone: node scripts/serve.mjs [--root dist/browser] [--port 4300]
 * Library:    const { url, close } = await startServer({ root, port })
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const GZIPPED = new Set(['.html', '.js', '.mjs', '.css']);

export async function startServer({ root, port = 0 } = {}) {
  if (!root) throw new Error('startServer: root is required');
  const base = resolve(root);
  const cache = new Map(); // file -> { mtimeMs, raw, gz }

  const load = async (file) => {
    const info = await stat(file);
    if (!info.isFile()) return null;
    const hit = cache.get(file);
    if (hit && hit.mtimeMs === info.mtimeMs) return hit;
    const raw = await readFile(file);
    const entry = {
      mtimeMs: info.mtimeMs,
      raw,
      gz: GZIPPED.has(extname(file)) ? gzipSync(raw, { level: 9 }) : null,
    };
    cache.set(file, entry);
    return entry;
  };

  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, 'http://x').pathname
      );
      let file = normalize(join(base, pathname));
      if (file !== base && !file.startsWith(base + sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      let entry = null;
      try {
        entry = await load(
          pathname.endsWith('/') ? join(file, 'index.html') : file
        );
      } catch {
        /* fall through */
      }
      if (entry) {
        if (pathname.endsWith('/')) file = join(file, 'index.html');
      } else if (extname(pathname)) {
        res.writeHead(404, { 'Cache-Control': 'no-store' }).end('not found');
        return;
      } else {
        file = join(base, 'index.html');
        entry = await load(file);
      } // SPA fallback
      if (!entry) {
        res.writeHead(404, { 'Cache-Control': 'no-store' }).end('not found');
        return;
      }
      const ext = extname(file);
      const wantsGzip =
        entry.gz &&
        /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
      const body = wantsGzip ? entry.gz : entry.raw;
      const headers = {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        // Cross-origin isolation: without it Chromium coarsens performance.now() to 100 us, which
        // quantised 1k-row edits to 0.0/0.1 ms (first integration run). Every resource is same-origin.
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        Vary: 'Accept-Encoding',
      };
      if (wantsGzip) headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      res
        .writeHead(500, { 'Cache-Control': 'no-store' })
        .end(String(error?.stack ?? error));
    }
  });

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    close: () =>
      new Promise((ok) => {
        server.closeAllConnections?.();
        server.close(() => ok());
      }),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(opt('root', join(here, '..', 'dist', 'browser')));
  const { url } = await startServer({ root, port: Number(opt('port', 0)) });
  console.log(`serving ${root} at ${url}`);
}
