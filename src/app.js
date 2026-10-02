import { STATUSES, STATUS_COLORS, hasCoordinates, whatsappUrl } from './leads.js';
import { emptyFilters, filterLeads } from './filters.js';
import { downloadCSV } from './storage.js';
import { getSupabase } from './lib/supabase.js';
import { createLojasService } from './services/lojas.js';
import { createMap } from './map.js';
import { $, esc, renderFilters, renderStats, renderList, renderForm, notify, ask } from './ui.js';

const store = { leads: [] };
let client, service, session = null, generation = 0, controller = new AbortController(), loggingOut = false;
let filters = emptyFilters(), region = null, filtered = [], page = 0, editing = null, formDirty = false, busy = false;
const map = createMap(openEditor, selectRegion, message => notify(message, true));
const change = () => { renderFilters(store.leads, filters); render(); };
function setBusy(value) {
  busy = value;
  $('refreshBtn').disabled = value; $('exportBtn').disabled = value || !session;
  document.querySelectorAll('#leadForm button, #leadForm input, #leadForm select, #leadForm textarea, [data-status]').forEach(el => el.disabled = value || !!(el.name && !service?.fields.has(el.name)) || !!(el.dataset.status && !service?.fields.has('status')));
}
function showLogin(message = '') {
  generation++; controller.abort(); controller = new AbortController(); session = null;
  service?.clear(); store.leads = []; editing = null; formDirty = false;
  $('leadDialog').close(); $('confirmDialog').close(); $('formFields').replaceChildren(); $('leadIdentity').textContent = '';
  $('notice').hidden = true; $('sessionEmail').textContent = ''; $('loginPassword').value = '';
  resetFilters(); $('appRoot').hidden = true; $('loginView').hidden = false;
  $('loginError').textContent = message; $('loginError').hidden = !message;
  $('saveState').textContent = ''; setBusy(false);
}
async function loadLojas() {
  if (!session || busy) return;
  const current = generation; setBusy(true); $('saveState').textContent = 'Carregando lojas…';
  try {
    const leads = await service.getLojas(controller.signal);
    if (current !== generation) return;
    store.leads = leads; change(); map.invalidate(); map.fit();
    $('saveState').textContent = leads.length ? '● Alterações salvas no Supabase' : 'Nenhuma loja disponível';
  } catch (error) {
    if (current !== generation || error.name === 'AbortError') return;
    if (error.expired) { showLogin(error.message); void client.auth.signOut({ scope: 'local' }); }
    else { $('saveState').textContent = 'Falha ao carregar · tente Atualizar lojas'; notify(error.message, true); }
  } finally { if (current === generation) setBusy(false); }
}
function applySession(next) {
  if (loggingOut) return;
  if (!next) { showLogin(); return; }
  const sameUser = session?.user.id === next.user.id;
  if (!sameUser) showLogin();
  session = next; $('loginView').hidden = true; $('appRoot').hidden = false;
  $('sessionEmail').textContent = next.user.email || ''; $('sourceName').textContent = 'Base · Supabase';
  map.invalidate();
  if (!sameUser) void loadLojas();
}
async function saveChanges(id, patch) {
  if (!session || busy) return null;
  const current = generation; setBusy(true); $('saveState').textContent = 'Salvando…';
  try {
    const next = await service.updateLoja(id, patch, controller.signal);
    if (current !== generation) return null;
    store.leads = store.leads.map(lead => lead.id === id ? next : lead); change();
    $('saveState').textContent = '✓ Alterações salvas no Supabase'; return next;
  } catch (error) {
    if (current !== generation || error.name === 'AbortError') return null;
    if (error.expired) { showLogin(error.message); void client.auth.signOut({ scope: 'local' }); }
    else { $('saveState').textContent = 'Alteração não salva'; notify(error.message, true); $('formError').textContent = error.message; $('formError').hidden = false; render(); }
    return null;
  } finally { if (current === generation) setBusy(false); }
}
function render(fit = false) {
  filtered = filterLeads(store.leads, filters, region);
  renderStats(filtered, region); page = renderList(filtered, page); map.sync(filtered);
  if (fit) map.fit();
  const count = Object.values(filters).filter(Boolean).length;
  $('filterCount').hidden = !count; $('filterCount').textContent = count;
}
function selectRegion(next) {
  region = next; page = 0; $('regionSelect').value = region?.id || '';
  map.setRegion(region, !!region); render(!region);
}
function resetFilters() {
  clearTimeout(searchTimer);
  filters = emptyFilters(); page = 0; region = null; map.setRegion(null); $('regionSelect').value = '';
  renderFilters(store.leads, filters); render(true);
}
function openEditor(id) {
  if (busy || !session) return;
  const lead = store.leads.find(l => l.id === id); if (!lead) return;
  editing = structuredClone(lead); formDirty = false; renderForm(editing, false, store.leads); setBusy(false);
}
async function closeEditor() {
  if (busy) return;
  if (formDirty && !await ask('Descartar esta edição?', 'Os campos alterados neste formulário ainda não foram aplicados ao lead.', 'Descartar edição', 'Continuar editando')) return;
  $('leadDialog').close(); formDirty = false; editing = null;
}
$('leadForm').addEventListener('input', () => { formDirty = true; });
$('leadForm').addEventListener('change', () => { formDirty = true; });
$('leadForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!editing || busy || !session) return;
  const patch = Object.fromEntries(new FormData(event.currentTarget));
  if (service.fields.has('review')) patch.review = event.currentTarget.elements.review.checked;
  for (const key of Object.keys(patch)) if (typeof patch[key] === 'string' && key !== 'notes') patch[key] = patch[key].trim();
  const next = { ...editing, ...patch };
  const coordsChanged = next.lat !== editing.lat || next.lon !== editing.lon;
  let error = '';
  if (coordsChanged && (next.lat || next.lon) && !hasCoordinates(next)) error = 'Informe latitude entre −90 e 90 e longitude entre −180 e 180, ou deixe ambas vazias.';
  if (next.whatsapp && next.whatsapp !== editing.whatsapp && !whatsappUrl(next.whatsapp)) error = 'Informe um número de WhatsApp válido ou um link wa.me.';
  if (error) { $('formError').textContent = error; $('formError').hidden = false; return; }
  const saved = await saveChanges(editing.id, patch);
  if (!saved) return;
  $('leadDialog').close(); formDirty = false; editing = null;
  if (!filtered.some(l => l.id === saved.id)) notify('Loja salva. Ela está fora dos filtros atuais.');
  if (coordsChanged && hasCoordinates(saved)) map.focus(saved.id);
});
$('closeDialog').onclick = closeEditor; $('cancelEdit').onclick = closeEditor;
$('leadDialog').addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
$('leadList').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit]'), focus = event.target.closest('[data-map]');
  if (edit) openEditor(edit.dataset.edit);
  if (focus) { $('leadsPanel').classList.remove('open'); map.invalidate(); if (!map.focus(focus.dataset.map)) notify('Este lead não tem coordenadas válidas. Edite latitude e longitude para colocá-lo no mapa.'); }
});
$('leadList').addEventListener('change', async event => {
  const id = event.target.dataset.status; if (!id) return;
  const lead = store.leads.find(l => l.id === id);
  if (lead) { const value = event.target.value; event.target.value = lead.status; await saveChanges(id, { status: value }); }
});
let searchTimer;
$('search').addEventListener('input', event => { clearTimeout(searchTimer); filters.search = event.target.value; searchTimer = setTimeout(() => { page = 0; render(); }, 180); });
for (const key of ['area', 'city', 'regional', 'bairro', 'status', 'contact', 'qualification', 'priority']) {
  $(key).addEventListener('change', () => {
    filters[key] = $(key).value; page = 0;
    if (key === 'area') { filters.city = ''; filters.regional = ''; filters.bairro = ''; }
    if (key === 'city') { filters.regional = ''; filters.bairro = ''; }
    if (key === 'regional') filters.bairro = '';
    renderFilters(store.leads, filters); render(true);
  });
}
document.querySelectorAll('[data-quick]').forEach(button => button.onclick = () => { const key = button.dataset.quick; filters[key] = !filters[key]; button.setAttribute('aria-pressed', String(filters[key])); page = 0; render(true); });
$('clearFilters').onclick = resetFilters; $('fitBtn').onclick = () => map.fit();
$('clearRegion').onclick = () => selectRegion(null);
$('regionSelect').onchange = () => selectRegion(map.regions.find(r => r.id === $('regionSelect').value) || null);
$('filtersBtn').onclick = () => { const panel = $('extraFilters'); panel.hidden = !panel.hidden; $('filtersBtn').setAttribute('aria-expanded', String(!panel.hidden)); map.invalidate(); };
$('prevPage').onclick = () => { page = Math.max(0, page - 1); renderList(filtered, page); $('leadList').scrollTop = 0; };
$('nextPage').onclick = () => { page++; page = renderList(filtered, page); $('leadList').scrollTop = 0; };
$('mobileListBtn').onclick = () => { $('leadsPanel').classList.add('open'); $('closeListBtn').focus(); };
$('closeListBtn').onclick = () => { $('leadsPanel').classList.remove('open'); $('mobileListBtn').focus(); };
$('dismissNotice').onclick = () => { $('notice').hidden = true; map.invalidate(); };
new ResizeObserver(() => map.invalidate()).observe($('map'));
$('legend').innerHTML = STATUSES.map(s => `<span><i class="dot" style="background:${STATUS_COLORS[s]}"></i>${esc(s)}</span>`).join('');

$('refreshBtn').onclick = async () => {
  if (formDirty && !await ask('Atualizar lojas?', 'A edição aberta ainda não foi salva. Deseja descartá-la?', 'Descartar e atualizar')) return;
  $('leadDialog').close(); formDirty = false; editing = null; await loadLojas();
};
$('exportBtn').onclick = () => { if (session && !busy) downloadCSV(structuredClone(store.leads)); };
$('logoutBtn').onclick = async () => {
  if (formDirty && !await ask('Sair do sistema?', 'A edição aberta ainda não foi salva. Deseja descartá-la?', 'Descartar e sair')) return;
  loggingOut = true; showLogin(); $('loginSubmit').disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      try { localStorage.removeItem('pamda-supabase-auth'); } catch {}
      await client.auth.stopAutoRefresh(); location.reload();
    }
  } catch {
    try { localStorage.removeItem('pamda-supabase-auth'); } catch {}
    location.reload();
  }
  finally { loggingOut = false; $('loginSubmit').disabled = false; }
};
$('loginForm').onsubmit = async event => {
  event.preventDefault(); if (!client || $('loginSubmit').disabled) return;
  $('loginSubmit').disabled = true; $('loginSubmit').textContent = 'Entrando…'; $('loginError').hidden = true;
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPassword').value });
    if (error) {
      const invalid = error.code === 'invalid_credentials' || error.status === 400;
      $('loginError').textContent = invalid ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
      $('loginError').hidden = false;
    } else { $('loginPassword').value = ''; applySession(data.session); }
  } catch { $('loginError').textContent = 'Não foi possível conectar. Tente novamente.'; $('loginError').hidden = false; }
  finally { $('loginSubmit').disabled = false; $('loginSubmit').textContent = 'Entrar'; }
};
window.addEventListener('beforeunload', event => { if (formDirty) { event.preventDefault(); event.returnValue = ''; } });
async function init() {
  showLogin(); $('loginSubmit').disabled = true;
  void map.loadRegions?.().then(regions => {
    $('regionSelect').innerHTML = '<option value="">Selecione no mapa ou aqui</option>' + regions.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(r => '<option value="' + esc(r.id) + '">' + esc(r.kind) + ' · ' + esc(r.name) + '</option>').join('');
  });
  try {
    client = getSupabase(); service = createLojasService(client);
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error('Não foi possível verificar sua sessão. Tente entrar novamente.');
    applySession(data.session);
    // Keep the auth callback synchronous; start database calls outside it.
    client.auth.onAuthStateChange((event, next) => {
      if (!next) showLogin();
      else { const current = generation; setTimeout(() => { if (current === generation) applySession(next); }, 0); }
    });
    $('loginSubmit').disabled = false;
  } catch (error) { showLogin(error.message); $('loginSubmit').disabled = !client; }
}
init();
