import { norm, newId, STATUSES } from './leads.js';

export const COLUMNS = [
  ['id', 'ID', 'id'], ['name', 'Nome da loja', 'name', 'nome'],
  ['area', 'Área', 'area'], ['regional', 'Regional', 'regional/cidade'],
  ['city', 'Cidade', 'city'], ['bairro', 'Bairro'], ['address', 'Endereço', 'address'],
  ['phone', 'Telefone', 'phone'], ['whatsapp', 'WhatsApp'],
  ['lat', 'Latitude', 'lat'], ['lon', 'Longitude', 'lon', 'lng'],
  ['place_id', 'Google Place ID', 'place_id'], ['status', 'Status', 'status_initial'],
  ['priority', 'Prioridade', 'priority'], ['qualification', 'Qualificação', 'qualificacao', 'qualification'],
  ['last_contact', 'Último contato', 'last_contact'], ['next_action', 'Próxima ação', 'next_action'],
  ['notes', 'Observações', 'notes'], ['review', 'Revisar', 'review'],
  ['review_reason', 'Motivo da revisão', 'Motivo revisão', 'review_reason'],
];
const aliases = new Map(COLUMNS.flatMap(([key, ...names]) => [key, ...names].map(n => [norm(n), key])));

// CSV state machine: quoted delimiters, embedded newlines and escaped quotes.
export function parseRows(input) {
  const text = String(input).replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closed = true; }
      } else value += char;
    } else if (char === delimiter || char === '\n' || char === '\r') {
      row.push(value); value = ''; closed = false;
      if (char !== delimiter) {
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (char === '"') {
      if (value || closed) throw new Error('CSV inválido: aspas fora de um campo delimitado.');
      quoted = true;
    } else {
      if (closed) { if (/\s/.test(char)) continue; throw new Error('CSV inválido após fechamento de aspas.'); }
      value += char;
    }
  }
  if (quoted) throw new Error('CSV incompleto: há aspas sem fechamento.');
  row.push(value);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

export function parseCSV(text) {
  const rows = parseRows(text);
  if (!rows.length) throw new Error('O CSV está vazio.');
  const headers = rows.shift().map(h => h.trim());
  const keys = headers.map(h => aliases.get(norm(h)) || `extra:${h}`);
  if (!keys.includes('name')) throw new Error('O CSV precisa da coluna Nome da loja (ou Nome/name).');
  if (new Set(keys).size !== keys.length || headers.some(h => !h)) throw new Error('Há cabeçalhos vazios ou repetidos no CSV.');
  const ids = new Set(); const warnings = []; let generatedIds = 0;
  const leads = rows.map((row, index) => {
    if (row.length > headers.length) throw new Error(`Registro ${index + 2}: há mais valores do que colunas.`);
    const lead = Object.fromEntries(COLUMNS.map(([key]) => [key, ''])); lead.extra = {};
    keys.forEach((key, i) => {
      const value = row[i] ?? '';
      if (key.startsWith('extra:')) lead.extra[key.slice(6)] = value;
      else lead[key] = value;
    });
    lead.id = lead.id.trim();
    if (!lead.id) { lead.id = newId(); generatedIds++; }
    if (ids.has(lead.id)) throw new Error(`ID duplicado no registro ${index + 2}: ${lead.id}. Corrija antes de importar.`);
    ids.add(lead.id);
    for (const key of ['area', 'regional', 'city', 'bairro', 'status', 'priority', 'qualification']) lead[key] = lead[key].trim();
    lead.status ||= STATUSES[0]; lead.priority ||= 'Normal'; lead.qualification ||= 'Pendente';
    lead.review = ['sim', 'true', '1', 'yes'].includes(norm(lead.review));
    return lead;
  });
  if (generatedIds) warnings.push(`${generatedIds} IDs foram criados. Salve ou exporte para preservá-los.`);
  return { leads, warnings, generatedIds };
}

export function exportCSV(leads) {
  const extra = [...new Set(leads.flatMap(l => Object.keys(l.extra || {})))];
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [[...COLUMNS.map(([, label]) => label), ...extra]];
  for (const lead of leads) rows.push([
    ...COLUMNS.map(([key]) => key === 'review' ? (lead.review ? 'Sim' : 'Não') : lead[key]),
    ...extra.map(key => lead.extra?.[key] ?? ''),
  ]);
  return '\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n') + '\r\n';
}

export async function readCSVFile(file) {
  const bytes = await file.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder('windows-1252').decode(bytes); }
  return parseCSV(text);
}
