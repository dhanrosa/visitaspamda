import { exportCSV } from './csv.js';

export const DRAFT_KEY = 'pamda-b2b-draft-v2';
export const LEGACY_KEY = 'pamda-b2b-lead-state-v1';
const copy = value => JSON.parse(JSON.stringify(value));
const signature = lead => JSON.stringify(lead);

export class LeadStore {
  constructor(storage = null) {
    this.storage = storage; this.leads = []; this.baseline = []; this.source = 'data/leads.csv';
    this.needsExport = false; this.handle = null; this.fileText = null; this.backupError = '';
  }
  load(leads, source, { handle = null, fileText = null, generatedIds = 0 } = {}) {
    this.leads = copy(leads); this.baseline = copy(leads); this.source = source;
    this.handle = handle; this.fileText = fileText; this.needsExport = generatedIds > 0;
  }
  get dirtyCount() {
    const previous = new Map(this.baseline.map(l => [l.id, signature(l)]));
    let count = 0;
    for (const lead of this.leads) { if (previous.get(lead.id) !== signature(lead)) count++; previous.delete(lead.id); }
    return Math.max(count + previous.size, this.needsExport ? 1 : 0);
  }
  upsert(lead) {
    const index = this.leads.findIndex(l => l.id === lead.id);
    if (index < 0) this.leads.push(copy(lead)); else this.leads[index] = copy(lead);
    this.backup();
  }
  markSaved(snapshot) { this.baseline = copy(snapshot); this.needsExport = false; this.backup(); }
  backup() {
    try {
      if (!this.storage) throw new Error('Armazenamento do navegador indisponível.');
      if (!this.dirtyCount) this.storage.removeItem(DRAFT_KEY);
      else this.storage.setItem(DRAFT_KEY, JSON.stringify({ version: 2, leads: this.leads, baseline: this.baseline, source: this.source, needsExport: this.needsExport, date: new Date().toISOString() }));
      this.backupError = '';
    } catch { this.backupError = 'Não foi possível guardar a recuperação neste navegador. Salve ou exporte antes de sair.'; }
  }
  restore(draft) {
    if (draft?.version !== 2 || !Array.isArray(draft.leads) || !Array.isArray(draft.baseline)) throw new Error('Rascunho de recuperação inválido.');
    this.load(draft.leads, draft.source);
    this.baseline = copy(draft.baseline); this.needsExport = !!draft.needsExport;
    this.backup();
  }
  migrateLegacy(legacy) {
    let count = 0;
    for (const lead of this.leads) {
      const old = legacy?.[lead.id]; if (!old || typeof old !== 'object') continue;
      const patch = {};
      for (const key of ['status', 'priority', 'qualification', 'notes']) if (typeof old[key] === 'string') patch[key] = old[key];
      if (Object.keys(patch).length) { Object.assign(lead, patch); count++; }
    }
    this.backup(); return count;
  }
  async saveToFile() {
    if (!this.handle) throw new Error('Abra um CSV para gravar nele ou use Exportar base.');
    const handle = this.handle;
    if (handle.queryPermission && await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Gravação não autorizada. Suas alterações continuam pendentes; use Exportar base.');
    }
    const diskText = await (await handle.getFile()).text();
    if (diskText !== this.fileText) throw new Error('O CSV foi alterado fora do aplicativo. Exporte suas alterações para outro arquivo antes de reabrir a base.');
    const snapshot = copy(this.leads), csv = exportCSV(snapshot);
    const writable = await handle.createWritable();
    try { await writable.write(csv); await writable.close(); }
    catch (error) { try { await writable.abort(); } catch {} throw error; }
    this.fileText = csv;
    this.markSaved(snapshot);
    return snapshot.length;
  }
}

export function readStored(storage, key) {
  const raw = storage?.getItem(key);
  return raw ? JSON.parse(raw) : null;
}
export function downloadCSV(leads, filename = 'pamda_base_atualizada.csv') {
  const blob = new Blob([exportCSV(leads)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
