import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, exportCSV } from '../src/csv.js';
import { filterLeads, filterOptions, emptyFilters } from '../src/filters.js';
import { hasCoordinates, whatsappUrl, stats } from '../src/leads.js';

test('base completa mantém IDs, dados e colunas extras após exportação', async () => {
  const input = 'ID;Nome;Cidade;Telefone;Observações;duplicate_count\n' + Array.from({ length: 1580 }, (_, i) => `${String(i).padStart(5, '0')};Loja fictícia ${i};Curitiba;04100000000;Teste;1`).join('\n');
  const original = parseCSV(input).leads;
  assert.equal(original.length, 1580);
  assert.equal(new Set(original.map(l => l.id)).size, 1580);
  assert.deepEqual(parseCSV(exportCSV(original)).leads, original);
});
test('CSV aceita BOM, ponto e vírgula, multiline, aspas e campos vazios', () => {
  const { leads } = parseCSV('\uFEFFID;Nome;Observações;Latitude;Longitude\r\na;"Loja; A";"Linha 1\n""Linha 2""";;');
  assert.equal(leads[0].notes, 'Linha 1\n"Linha 2"');
  assert.equal(hasCoordinates(leads[0]), false);
  assert.deepEqual(parseCSV(exportCSV(leads)).leads, leads);
});
test('importação rejeita IDs duplicados e CSV malformado sem mesclar lojas', () => {
  assert.throws(() => parseCSV('ID,Nome\na,A\na,B'), /duplicado/);
  assert.throws(() => parseCSV('ID,Nome\na,"A'), /fechamento/);
  assert.throws(() => parseCSV('ID,Nome\na,A,excesso'), /colunas/);
  const result = parseCSV('Nome\nMesmo nome\nMesmo nome');
  assert.equal(result.generatedIds, 2);
  assert.notEqual(result.leads[0].id, result.leads[1].id);
});
test('filtros reconhecem novas cidades e combinam região, busca, status e WhatsApp', () => {
  const leads = parseCSV('ID;Nome;Área;Cidade;Regional;Status;WhatsApp\na;Loja A;Santa Catarina;Joinville;Centro;Não contatado;47999999999\nb;Loja B;Paraná;Londrina;Norte;Cliente ativo;').leads;
  const f = { ...emptyFilters(), city: 'Joinville', untouched: true, whatsapp: true, search: 'loja' };
  assert.deepEqual(filterOptions(leads, emptyFilters()).city, ['Joinville', 'Londrina']);
  assert.deepEqual(filterLeads(leads, f).map(l => l.id), ['a']);
  assert.equal(filterLeads(leads, f, { match: { city: 'Londrina' } }).length, 0);
  assert.equal(stats(leads).clients, 1);
});
test('coordenadas e links externos são validados', () => {
  assert.equal(hasCoordinates({ lat: '0', lon: '0' }), true);
  assert.equal(hasCoordinates({ lat: '91', lon: '12' }), false);
  assert.equal(hasCoordinates({ lat: '-25,5', lon: '-49,2' }), true);
  assert.equal(whatsappUrl('javascript:alert(1)'), '');
  assert.equal(whatsappUrl('https://example.com/5541999999999'), '');
  assert.equal(whatsappUrl('(41) 99999-9999'), 'https://wa.me/5541999999999');
});
