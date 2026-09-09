import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;

const types = { '.html': 'text/html', '.js': 'text/javascript' };
createServer(async (req, res) => {
  const path = join(ROOT, (req.url ?? '/').split('?')[0]);
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404).end('nope');
  }
}).listen(8791, () => console.log('listening'));
