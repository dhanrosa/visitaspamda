import { COLUMNS } from '../csv.js';
import { norm, STATUSES, coordinate } from '../leads.js';

const normalizeColumn = value => norm(value).replace(/[\s_/-]+/g, '');
const aliases = Object.fromEntries(COLUMNS.map(([key, ...names]) => [key, [key, ...names]]));
Object.assign(aliases, {
  name: ['name', 'nome', 'nome da loja', 'nome_loja'],
  address: ['address', 'endereco', 'endereço'],
  notes: ['notes', 'observacoes', 'observações', 'obs'],
  review_reason: ['review_reason', 'motivo da revisão', 'motivo revisão', 'motivo_revisao'],
});

export class LojaError extends Error {
  constructor(message, expired = false) { super(message); this.name = 'LojaError'; this.expired = expired; }
}
export function databaseError(error, status) {
  if (status === 401 || ['PGRST301', 'PGRST302', 'PGRST303'].includes(error?.code)) {
    return new LojaError('Sua sessão expirou. Entre novamente.', true);
  }
  if (status === 403 || error?.code === '42501') return new LojaError('Sua conta não tem permissão para esta operação.');
  if (error?.code === 'PGRST116') return new LojaError('Não foi possível confirmar a alteração. A loja pode ter sido removida ou seu acesso pode ter mudado.');
  if (String(error?.code || '').startsWith('22') || String(error?.code || '').startsWith('23')) {
    return new LojaError('Confira os campos preenchidos. Um valor não foi aceito pela tabela.');
  }
  return new LojaError('Não foi possível acessar as lojas. Verifique sua conexão e tente novamente.');
}

export function createMapping(rows) {
  const columns = new Set(rows.flatMap(row => Object.keys(row)));
  const mapping = {};
  for (const [field, names] of Object.entries(aliases)) {
    const column = names.map(name => [...columns].find(c => normalizeColumn(c) === normalizeColumn(name))).find(Boolean);
    if (column) mapping[field] = column;
  }
  if (rows.length && (mapping.id !== 'id' || !mapping.name)) {
    throw new LojaError('Não foi possível reconhecer as colunas de identificação e nome das lojas. Revise o mapeamento da base.');
  }
  return mapping;
}

export function mapLojaFromDatabase(row, mapping = createMapping([row])) {
  if (typeof row.id !== 'string' || !row.id.trim()) throw new LojaError('A base contém uma loja sem ID de texto válido.');
  const lead = Object.fromEntries(COLUMNS.map(([key]) => [key, '']));
  const known = new Set(Object.values(mapping));
  for (const [field, column] of Object.entries(mapping)) lead[field] = row[column] == null ? '' : String(row[column]);
  lead.id = row.id;
  lead.review = ['sim', 'true', '1', 'yes', 't'].includes(norm(row[mapping.review]));
  lead.status ||= STATUSES[0]; lead.priority ||= 'Normal'; lead.qualification ||= 'Pendente';
  lead.extra = Object.fromEntries(Object.entries(row).filter(([key]) => !known.has(key)));
  return lead;
}

export function mapChangesToDatabase(previous, changes, mapping, samples = {}) {
  const original = mapLojaFromDatabase(previous, mapping), patch = {};
  for (const [field, value] of Object.entries(changes)) {
    if (field === 'id' || field === 'extra' || !(field in aliases)) throw new LojaError('Este campo não pode ser alterado.');
    if (value === original[field]) continue;
    const column = mapping[field];
    if (!column) throw new LojaError('Este campo não existe na tabela de lojas.');
    const sample = previous[column] ?? samples[column];
    if (field === 'review') {
      if (typeof value !== 'boolean') throw new LojaError('Informe uma opção válida para revisão.');
      patch[column] = typeof sample === 'string'
        ? (['sim', 'nao'].includes(norm(sample)) ? (value ? 'Sim' : 'Não') : value ? 'true' : 'false')
        : typeof sample === 'number' ? Number(value) : value;
    } else if (field === 'lat' || field === 'lon') {
      const number = coordinate(value);
      if (String(value ?? '').trim() && (number === null || Math.abs(number) > (field === 'lat' ? 90 : 180))) throw new LojaError('Informe coordenadas válidas.');
      patch[column] = number === null ? null : typeof sample === 'string' ? String(number) : number;
    } else {
      // Empty dates/numeric columns must not receive an invalid empty string.
      patch[column] = value === '' ? null : String(value);
    }
  }
  return patch;
}

export function createLojasService(client) {
  let rowsById = new Map(), mapping = {}, samples = {};
  return {
    get fields() { return new Set(Object.keys(mapping).filter(key => key !== 'id')); },
    clear() { rowsById.clear(); mapping = {}; samples = {}; },
    async getLojas(signal) {
      const rows = [], ids = new Set(); let total = null;
      // Supabase caps responses. Read ordered pages even when the project cap is < 500.
      while (true) {
        const request = client.from('lojas').select('*', rows.length ? {} : { count: 'exact' })
          .order('id', { ascending: true }).range(rows.length, rows.length + 499);
        const { data, error, status, count } = await request.abortSignal(signal);
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (error) throw databaseError(error, status);
        if (!Array.isArray(data)) throw new LojaError('A resposta das lojas não pôde ser carregada.');
        if (!rows.length && count != null) total = count;
        if (!data.length) {
          if (total != null && rows.length < total) throw new LojaError('A base mudou durante a leitura. Atualize as lojas para tentar novamente.');
          break;
        }
        for (const row of data) {
          if (ids.has(row.id)) throw new LojaError('A base mudou durante a leitura. Atualize as lojas para tentar novamente.');
          ids.add(row.id); rows.push(row);
        }
        if (total != null && rows.length >= total) break;
      }
      const nextMapping = createMapping(rows);
      const leads = rows.map(row => mapLojaFromDatabase(row, nextMapping));
      rowsById = new Map(rows.map(row => [row.id, row])); mapping = nextMapping; samples = {};
      for (const row of rows) for (const [key, value] of Object.entries(row)) if (value != null && samples[key] == null) samples[key] = value;
      return leads;
    },
    async updateLoja(id, changes, signal) {
      const previous = rowsById.get(id);
      if (!previous) throw new LojaError('Esta loja não está disponível. Atualize a base.');
      const patch = mapChangesToDatabase(previous, changes, mapping, samples);
      if (!Object.keys(patch).length) return mapLojaFromDatabase(previous, mapping);
      const { data, error, status } = await client.from('lojas').update(patch).eq('id', id).select('*').single().abortSignal(signal);
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (error) throw databaseError(error, status);
      if (!data || data.id !== id) throw new LojaError('Não foi possível confirmar o salvamento desta loja. Atualize a base antes de tentar novamente.');
      const lead = mapLojaFromDatabase(data, mapping);
      rowsById.set(id, data);
      return lead;
    },
  };
}
