import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { publicAssets } from '../vite.config.js';

const root = resolve('dist');
const allowedData = new Set(publicAssets.filter(file => file.startsWith('data/')));
let count = 0;
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) { await inspect(path); continue; }
    const file = relative(root, path).replaceAll('\\', '/');
    assert(!/\.csv$|(^|\/)\.env|leads\.json|\.map$|\.(pem|key)$/i.test(file), `Arquivo privado no build: ${file}`);
    if (file.startsWith('data/')) assert(allowedData.has(file), `Dados não autorizados: ${file}`);
    const content = await readFile(path, 'utf8');
    assert(!/sb_secret_[A-Za-z0-9_-]+/.test(content), `Chave secreta em ${file}`);
    for (const token of content.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      let payload;
      try { payload = JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url').toString()); } catch { continue; }
      assert(payload.role !== 'service_role', `Token privilegiado em ${file}`);
    }
    assert(!content.includes('data/leads.csv'), `Dependência da base local em ${file}`);
    count++;
  }
}
await inspect(root);
console.log(`Build revisado: ${count} arquivos, sem CSV, base de leads, sourcemaps ou credenciais privilegiadas.`);
