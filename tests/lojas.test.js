import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapping, mapLojaFromDatabase, mapChangesToDatabase, createLojasService, databaseError } from '../src/services/lojas.js';

test('adaptador preserva ID text, aliases, telefone e extras sem alterar campos ausentes', () => {
  const row = { id: '001', nome: 'Loja', endereco: 'Rua', telefone: '041', cidade: 'Curitiba', latitude: -25, longitude: -49, observacoes: null, review: false, instagram: '@loja', duplicate_count: 2 };
  const mapping = createMapping([row]);
  const lead = mapLojaFromDatabase(row, mapping);
  assert.equal(lead.id, '001'); assert.equal(lead.phone, '041'); assert.equal(lead.city, 'Curitiba');
  assert.deepEqual(lead.extra, { instagram: '@loja', duplicate_count: 2 });
  assert.deepEqual(mapChangesToDatabase(row, { name: 'Nova', lat: '-25,5', notes: 'Teste', review: true }, mapping), { nome: 'Nova', latitude: -25.5, observacoes: 'Teste', review: true });
  assert.throws(() => mapChangesToDatabase(row, { id: '002' }, mapping));
  assert.throws(() => mapChangesToDatabase(row, { priority: 'Alta' }, mapping));
  assert.throws(() => mapChangesToDatabase(row, { lon: '200' }, mapping));
});

test('paginação usa a quantidade recebida mesmo com limite menor que 500 e update confirma ID', async () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({ id: String(index), nome: `Loja ${index}`, status: 'Não contatado' }));
  const ranges = []; let patch, selectedId;
  const client = { from(table) {
    assert.equal(table, 'lojas'); let start, updating = false;
    const query = {
      select() { return query; }, order() { return query; },
      range(from) { start = from; ranges.push(from); return query; },
      update(value) { patch = value; updating = true; return query; },
      eq(column, value) { assert.equal(column, 'id'); selectedId = value; return query; },
      single() { return query; },
      async abortSignal() { return updating ? { data: { ...rows.find(row => row.id === selectedId), ...patch } } : { data: rows.slice(start, start + 2), count: rows.length }; },
    }; return query;
  } };
  const service = createLojasService(client);
  assert.equal((await service.getLojas()).length, 7); assert.deepEqual(ranges, [0, 2, 4, 6]);
  assert.equal((await service.updateLoja('0', { status: 'Respondeu' })).status, 'Respondeu');
  assert.deepEqual(patch, { status: 'Respondeu' });
  service.clear(); await assert.rejects(service.updateLoja('0', { status: 'Cliente ativo' }));
});

test('erros de sessão e RLS usam mensagens amigáveis', () => {
  assert.equal(databaseError({ message: 'private detail' }, 401).expired, true);
  assert.match(databaseError({ code: '42501' }, 403).message, /permissão/);
  assert(!databaseError({ message: 'private detail' }, 500).message.includes('private detail'));
});
