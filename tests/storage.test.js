import test from 'node:test';
import assert from 'node:assert/strict';
import { LeadStore, DRAFT_KEY } from '../src/storage.js';
import { parseCSV } from '../src/csv.js';
const memory = () => { const map = new Map(); return { getItem: k => map.get(k), setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }; };
const leads = () => parseCSV('ID,Nome\na,Loja A\nb,Loja B').leads;
test('contagem por lead, recuperação e edição revertida', () => {
  const storage = memory(), store = new LeadStore(storage); store.load(leads(), 'teste.csv');
  store.upsert({ ...store.leads[0], notes: 'Ação' });
  store.upsert({ ...store.leads[0], phone: '123' });
  assert.equal(store.dirtyCount, 1);
  const recovered = new LeadStore(storage); recovered.restore(JSON.parse(storage.getItem(DRAFT_KEY)));
  assert.equal(recovered.dirtyCount, 1); assert.equal(recovered.leads[0].notes, 'Ação');
  store.upsert(leads()[0]); assert.equal(store.dirtyCount, 0);
});
test('falha de backup é visível e não apaga edições em memória', () => {
  const store = new LeadStore({ setItem() { throw new Error('quota'); } }); store.load(leads(), 'base');
  store.upsert({ ...store.leads[0], notes: 'Não perder' });
  assert.match(store.backupError, /Não foi possível/); assert.equal(store.dirtyCount, 1);
});
test('gravação detecta conflito externo e mantém pendências', async () => {
  const store = new LeadStore(memory()); store.load(leads(), 'base', { fileText: 'original', handle: { getFile: async () => ({ text: async () => 'modificado' }) } });
  store.upsert({ ...store.leads[0], notes: 'A' });
  await assert.rejects(store.saveToFile(), /fora do aplicativo/); assert.equal(store.dirtyCount, 1);
});
test('falha ao fechar arquivo mantém alterações não salvas', async () => {
  const store = new LeadStore(memory()); store.load(leads(), 'base', { fileText: 'original', handle: { getFile: async () => ({ text: async () => 'original' }), createWritable: async () => ({ write: async () => {}, close: async () => { throw new Error('disco'); }, abort: async () => {} }) } });
  store.upsert({ ...store.leads[0], notes: 'A' });
  await assert.rejects(store.saveToFile(), /disco/); assert.equal(store.dirtyCount, 1);
});
test('edição durante gravação continua pendente', async () => {
  const store = new LeadStore(memory()); store.load(leads(), 'base', { fileText: 'original', handle: { getFile: async () => ({ text: async () => 'original' }), createWritable: async () => ({ write: async () => { store.upsert({ ...store.leads[0], notes: 'Durante gravação' }); }, close: async () => {} }) } });
  store.upsert({ ...store.leads[0], notes: 'Antes' });
  await store.saveToFile(); assert.equal(store.dirtyCount, 1); assert.equal(store.baseline[0].notes, 'Antes');
});
test('permissão negada não grava nem remove o rascunho', async () => {
  const storage = memory(), store = new LeadStore(storage);
  store.load(leads(), 'base', { handle: { queryPermission: async () => 'prompt', requestPermission: async () => 'denied' } });
  store.upsert({ ...store.leads[0], notes: 'Pendente' });
  await assert.rejects(store.saveToFile(), /não autorizada/);
  assert.equal(store.dirtyCount, 1); assert.ok(storage.getItem(DRAFT_KEY));
});
