import { STATUSES, STATUS_COLORS, PRIORITIES, QUALIFICATIONS, unique, hasCoordinates, whatsappUrl, mapsUrl, stats } from './leads.js';
import { filterOptions } from './filters.js';
export const $ = id => document.getElementById(id);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const number = value => value.toLocaleString('pt-BR');
export const PAGE_SIZE = 40;
const options = (values, selected) => values.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
const labels = { area: 'Todas as áreas', city: 'Todas as cidades', regional: 'Todas as regionais', bairro: 'Todos os bairros', status: 'Todos os status', qualification: 'Todas as qualificações', priority: 'Todas as prioridades' };
export function renderFilters(leads, filters) {
  // Re-evaluate after each parent reset so no child keeps an impossible option.
  for (const key of Object.keys(labels)) {
    const values = filterOptions(leads, filters)[key];
    if (!values.includes(filters[key])) filters[key] = '';
    $(key).innerHTML = `<option value="">${labels[key]}</option>` + options(values, filters[key]);
  }
  $('contact').value = filters.contact; $('search').value = filters.search;
  document.querySelectorAll('[data-quick]').forEach(b => b.setAttribute('aria-pressed', String(filters[b.dataset.quick])));
  const count = Object.values(filters).filter(Boolean).length;
  $('filterCount').hidden = !count; $('filterCount').textContent = count;
}
export function renderStats(leads, region) {
  const s = stats(leads);
  for (const [id, key] of Object.entries({ kTotal: 'total', kWa: 'whatsapp', kNew: 'untouched', kInterested: 'interested', kClients: 'clients' })) $(id).textContent = number(s[key]);
  $('mappedCount').textContent = `${number(s.total - s.unmapped)} no mapa${s.unmapped ? ` · ${number(s.unmapped)} sem coordenadas válidas` : ''}`;
  $('mobileListBtn').textContent = `Ver ${number(s.total)} leads`;
  $('regionSummary').hidden = !region;
  if (region) {
    $('regionKind').textContent = region.kind; $('regionName').textContent = region.name;
    $('regionStats').innerHTML = [['total', 'Leads'], ['whatsapp', 'WhatsApp'], ['untouched', 'Não contatados'], ['replied', 'Responderam'], ['interested', 'Interessados'], ['clients', 'Clientes']].map(([key, label]) => `<div><strong>${number(s[key])}</strong><span>${label}</span></div>`).join('');
  }
}
export function renderList(leads, page) {
  const pages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE)); page = Math.min(page, pages - 1);
  const shown = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  $('listCount').textContent = number(leads.length);
  $('pageInfo').textContent = leads.length ? `${number(page * PAGE_SIZE + 1)}–${number(Math.min((page + 1) * PAGE_SIZE, leads.length))} de ${number(leads.length)}` : 'Nenhum resultado';
  $('prevPage').disabled = page === 0; $('nextPage').disabled = page >= pages - 1;
  $('leadList').innerHTML = shown.length ? shown.map(l => {
    const wa = whatsappUrl(l.whatsapp), color = STATUS_COLORS[l.status] || '#91a0ad';
    return `<article class="lead-card" data-id="${esc(l.id)}"><h3>${esc(l.name || 'Loja sem nome')}</h3><p class="lead-location">${esc([l.bairro, l.city].filter(Boolean).join(' · ') || 'Localização não informada')}</p><p class="lead-address">${esc(l.address || 'Endereço não informado')}</p><div class="lead-status-row"><i class="dot" style="background:${color}"></i><select class="inline-status" data-status="${esc(l.id)}" aria-label="Status de ${esc(l.name || l.id)}">${options(unique([...STATUSES, l.status]), l.status)}</select>${l.review ? '<span class="review-badge">Revisar</span>' : ''}</div><div class="lead-dates"><span>Último contato <b>${esc(l.last_contact || '—')}</b></span><span>Próxima ação <b>${esc(l.next_action || 'Não definida')}</b></span></div><div class="lead-actions">${wa ? `<a class="wa" href="${wa}" target="_blank" rel="noopener noreferrer">WhatsApp <span>↗</span></a>` : ''}<button data-map="${esc(l.id)}" ${hasCoordinates(l) ? '' : 'disabled title="Informe latitude e longitude para localizar no mapa"'}>Mapa</button><button data-edit="${esc(l.id)}">Editar</button><a href="${esc(mapsUrl(l))}" target="_blank" rel="noopener noreferrer" title="Abrir no Google Maps" aria-label="Google Maps de ${esc(l.name || l.id)}">↗</a></div></article>`;
  }).join('') : '<div class="empty">Nenhum lead nesta seleção.<br>Experimente limpar os filtros ou selecionar outra região.</div>';
  return page;
}
export function renderSaveState(store, exported = false) {
  const count = store.dirtyCount;
  $('sourceName').textContent = `${store.handle ? 'Arquivo vinculado' : 'Base'} · ${store.source}`;
  $('saveState').classList.toggle('dirty', count > 0);
  $('saveState').textContent = count ? `● ${number(count)} ${count === 1 ? 'alteração não salva' : 'alterações não salvas'}` : exported ? '✓ Cópia exportada · arquivo de origem não alterado' : '● Sem alterações pendentes';
  $('saveState').title = 'A contagem representa leads modificados desde a última gravação ou exportação confirmada.';
  $('saveBtn').disabled = !count;
  $('saveBtn').title = store.handle ? 'Gravar no CSV aberto' : 'Exportar uma cópia; para gravar no mesmo arquivo, use Abrir base';
  $('backupWarning').hidden = !store.backupError; $('backupWarning').textContent = store.backupError;
}
export function notify(message, warning = false) {
  $('noticeText').textContent = message; $('notice').hidden = false; $('notice').classList.toggle('warning', warning);
}
export function ask(title, message, yes = 'Continuar', no = 'Cancelar') {
  $('confirmTitle').textContent = title; $('confirmMessage').textContent = message; $('confirmYes').textContent = yes; $('confirmNo').textContent = no;
  const dialog = $('confirmDialog'); dialog.showModal();
  return new Promise(resolve => {
    const done = value => { dialog.close(); $('confirmYes').onclick = null; $('confirmNo').onclick = null; dialog.oncancel = null; resolve(value); };
    $('confirmYes').onclick = () => done(true); $('confirmNo').onclick = () => done(false);
    dialog.oncancel = event => { event.preventDefault(); done(false); };
  });
}
export function renderForm(lead, isNew, leads) {
  $('dialogTitle').textContent = isNew ? 'Adicionar lead' : 'Editar lead';
  $('leadIdentity').textContent = isNew ? 'O ID será criado automaticamente. Coordenadas são opcionais.' : `ID interno: ${lead.id}`;
  const field = (key, label, { full = false, required = false, values = null, placeholder = '', suggest = false, textarea = false } = {}) => {
    const value = lead[key] ?? '', id = `edit-${key}`, list = `suggest-${key}`;
    let control = values ? `<select id="${id}" name="${key}">${options(unique([...values, value]), value)}</select>` : textarea ? `<textarea id="${id}" name="${key}">${esc(value)}</textarea>` : `<input id="${id}" name="${key}" value="${esc(value)}" ${required ? 'required' : ''} placeholder="${esc(placeholder)}" ${suggest ? `list="${list}"` : ''}>`;
    if (suggest) control += `<datalist id="${list}">${options(unique(leads.map(l => l[key])), '')}</datalist>`;
    return `<div class="form-field${full ? ' full' : ''}"><label for="${id}">${label}</label>${control}</div>`;
  };
  $('formFields').innerHTML = '<h3 class="form-section">01 / LOJA E LOCALIZAÇÃO</h3>' +
    field('name', 'Nome da loja', { full: true, required: isNew }) + field('area', 'Área', { suggest: true }) + field('regional', 'Regional', { suggest: true }) + field('city', 'Cidade', { suggest: true }) + field('bairro', 'Bairro', { suggest: true }) + field('address', 'Endereço', { full: true }) + field('phone', 'Telefone') + field('whatsapp', 'WhatsApp', { placeholder: '+55 (41) 99999-9999 ou link wa.me' }) + field('lat', 'Latitude', { placeholder: 'Ex.: -25.4284' }) + field('lon', 'Longitude', { placeholder: 'Ex.: -49.2733' }) + field('place_id', 'Google Place ID (opcional)', { full: true }) + '<h3 class="form-section">02 / RELACIONAMENTO COMERCIAL</h3>' + field('status', 'Status', { values: [...STATUSES, ...leads.map(l => l.status)] }) + field('priority', 'Prioridade', { values: [...PRIORITIES, ...leads.map(l => l.priority)] }) + field('qualification', 'Qualificação', { values: [...QUALIFICATIONS, ...leads.map(l => l.qualification)] }) + field('last_contact', 'Último contato', { placeholder: 'AAAA-MM-DD ou data e horário' }) + field('next_action', 'Próxima ação', { full: true, placeholder: 'Ex.: Enviar catálogo na próxima terça' }) + field('notes', 'Observações', { full: true, textarea: true }) + `<label class="check-field full"><input type="checkbox" name="review" ${lead.review ? 'checked' : ''}> Marcar para revisão</label>` + field('review_reason', 'Motivo da revisão', { full: true });
  $('formError').hidden = true;
  $('leadDialog').showModal(); $('leadDialog').querySelector('.dialog-body').scrollTop = 0;
}
