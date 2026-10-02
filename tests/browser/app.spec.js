import { test, expect } from '@playwright/test';

const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'qa@example.test' };
const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test-signature';
const session = { access_token: token, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const rows = () => Array.from({ length: 1580 }, (_, i) => ({
  id: String(i).padStart(5, '0'), nome: `Loja QA ${i}`, cidade: i % 2 ? 'Curitiba' : 'Pinhais', bairro: i % 2 ? 'Centro' : 'Emiliano Perneta', area: i % 2 ? 'Curitiba' : 'RMC', regional: i % 2 ? 'MATRIZ' : '',
  endereco: `Rua QA ${i}`, telefone: '04133330000', whatsapp: '5541999999999', lat: -25.43 + (i % 10) / 1000, lon: -49.27 + (i % 10) / 1000, status: 'Não contatado', review: false, observacoes: '', instagram: '@qa', duplicate_count: 1,
}));
async function mock(page, { authenticated = false, data = rows(), loadError = 0, updateError = 0, loginError = 0, delay = 0 } = {}) {
  const state = { data, reads: 0, updates: [], loadError, updateError, loginError, delay };
  if (authenticated) await page.addInitScript(value => { if (!localStorage.getItem('pamda-supabase-auth')) localStorage.setItem('pamda-supabase-auth', JSON.stringify(value)); }, session);
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }));
  await page.route('https://pamda-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (status, body, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token') {
      if (state.loginError) return reply(state.loginError, { code: 'invalid_credentials', msg: 'technical private error' });
      return reply(200, session);
    }
    if (url.pathname === '/auth/v1/user') return reply(200, user);
    if (url.pathname === '/auth/v1/logout') return reply(200, {});
    if (url.pathname !== '/rest/v1/lojas') return reply(404, {});
    if (!request.headers().authorization?.includes(token)) return reply(401, { code: 'PGRST301' });
    if (request.method() === 'GET') {
      state.reads++;
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.loadError) return reply(state.loadError, { code: state.loadError === 401 ? 'PGRST301' : 'XX', message: 'private error' });
      const start = Number(url.searchParams.get('offset') || 0);
      // Simulates a project cap below the requested page size.
      const part = state.data.slice(start, start + 250);
      return reply(200, part, { 'content-range': `${start}-${start + part.length - 1}/${state.data.length}`, 'access-control-expose-headers': 'content-range' });
    }
    if (request.method() === 'PATCH') {
      const patch = request.postDataJSON(); state.updates.push({ id: url.searchParams.get('id'), patch });
      if (state.updateError) return reply(state.updateError, { code: state.updateError === 401 ? 'PGRST301' : '42501', message: 'private error' });
      const row = state.data.find(row => 'eq.' + row.id === url.searchParams.get('id')); Object.assign(row, patch); return reply(200, row);
    }
    throw new Error('Forbidden database operation: ' + request.method());
  });
  return state;
}
async function ready(page) { await page.goto('/'); await expect(page.locator('#kTotal')).toHaveText('1.580'); await expect(page.locator('#saveState')).toContainText('salvas'); }
async function login(page) { await page.getByLabel('E-mail', { exact: true }).fill('qa@example.test'); await page.getByLabel('Senha', { exact: true }).fill('fake-password'); await page.getByRole('button', { name: 'Entrar', exact: true }).click(); }

test('falha de inicialização mostra aviso e permite recarregar', async ({ page }) => {
  await page.route('**/src/app.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#loginError')).toContainText('Não foi possível iniciar');
  await expect(page.getByRole('button', { name: 'Recarregar página', exact: true })).toBeEnabled();
});

test('sem sessão: somente login, credenciais inválidas, login válido, refresh e logout', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = await mock(page, { loginError: 400 });
  await page.goto('/'); await expect(page.locator('#loginView')).toBeVisible(); await expect(page.locator('#appRoot')).toBeHidden();
  await page.screenshot({ path: '.tmp/pamda-login.png', fullPage: true });
  expect(state.reads).toBe(0);
  await login(page); await expect(page.locator('#loginError')).toHaveText('E-mail ou senha inválidos.'); expect(state.reads).toBe(0);
  state.loginError = 0; await login(page); await expect(page.locator('#kTotal')).toHaveText('1.580');
  await page.reload(); await expect(page.locator('#kTotal')).toHaveText('1.580'); await expect(page.locator('#appRoot')).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click(); await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('.lead-card')).toHaveCount(0); await expect(page.locator('#formFields')).toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('pamda-supabase-auth'))).toBeNull();
  await page.reload(); await expect(page.locator('#appRoot')).toBeHidden(); expect(errors).toEqual([]);
});

test('base paginada, busca, filtros, mapa, formulário e UPDATE sem reload', async ({ page }) => {
  const state = await mock(page, { authenticated: true }); await ready(page); expect(state.reads).toBe(7);
  await page.screenshot({ path: '.tmp/pamda-authenticated.png', fullPage: true });
  await page.locator('#city').selectOption('Curitiba'); await expect(page.locator('#kTotal')).toHaveText('790');
  await page.locator('#clearFilters').click(); await page.locator('#search').fill('Loja QA 1579'); await expect(page.locator('#kTotal')).toHaveText('1');
  await page.getByRole('button', { name: 'Mapa', exact: true }).click(); await expect(page.locator('.leaflet-popup')).toContainText('Loja QA 1579');
  await page.locator('#leadList').getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('Prioridade', { exact: true }).last()).toBeDisabled();
  await page.getByLabel('Observações', { exact: true }).fill('Contato QA');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.locator('#leadDialog')).not.toBeVisible(); expect(state.updates.at(-1)).toEqual({ id: 'eq.01579', patch: { observacoes: 'Contato QA' } });
  await page.locator('[data-status="01579"]').selectOption('Respondeu'); await expect(page.locator('[data-status="01579"]')).toHaveValue('Respondeu');
  expect(state.updates.at(-1).patch).toEqual({ status: 'Respondeu' }); expect(state.reads).toBe(7);
  await page.reload(); await expect(page.locator('#kTotal')).toHaveText('1.580'); await page.locator('#search').fill('Loja QA 1579');
  await expect(page.locator('#kTotal')).toHaveText('1');
  await page.locator('#leadList').getByRole('button', { name: 'Editar', exact: true }).click(); await expect(page.getByLabel('Observações', { exact: true })).toHaveValue('Contato QA');
});

test('erro de leitura, retry e base vazia', async ({ page }) => {
  const state = await mock(page, { authenticated: true, loadError: 500 }); await page.goto('/');
  await expect(page.locator('#saveState')).toContainText('Falha ao carregar'); await expect(page.locator('#notice')).not.toContainText('private error');
  state.loadError = 0; state.data = []; await page.locator('#refreshBtn').click(); await expect(page.locator('#saveState')).toHaveText('Nenhuma loja disponível'); await expect(page.locator('#kTotal')).toHaveText('0');
});

test('falha de UPDATE mantém edição e sessão expirada limpa dados', async ({ page }) => {
  const state = await mock(page, { authenticated: true, updateError: 403 }); await ready(page);
  await page.locator('#search').fill('Loja QA 1579'); await expect(page.locator('#kTotal')).toHaveText('1');
  await page.locator('#leadList').getByRole('button', { name: 'Editar', exact: true }).click(); await page.getByLabel('Observações', { exact: true }).fill('Não perder');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click(); await expect(page.locator('#formError')).toContainText('permissão'); await expect(page.getByLabel('Observações', { exact: true })).toHaveValue('Não perder');
  state.updateError = 401; await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click(); await expect(page.locator('#loginView')).toBeVisible(); await expect(page.locator('.lead-card')).toHaveCount(0); await expect(page.locator('#leadDialog')).not.toBeVisible();
});

test('resposta tardia após logout não restaura lojas', async ({ page }) => {
  const state = await mock(page, { authenticated: true }); await ready(page);
  state.delay = 300; await page.locator('#refreshBtn').click(); await page.locator('#logoutBtn').click(); await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#appRoot')).toBeHidden(); await expect(page.locator('.lead-card')).toHaveCount(0);
});

test('celular: login e lista responsiva', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mock(page); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeInViewport(); await login(page); await expect(page.locator('#kTotal')).toHaveText('1.580');
  await page.locator('#mobileListBtn').click(); await expect(page.locator('#leadsPanel')).toHaveClass(/open/); await expect(page.locator('#closeListBtn')).toBeInViewport();
  await page.screenshot({ path: '.tmp/pamda-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('servidor não entrega base antiga nem arquivos de ambiente', async ({ request }) => {
  for (const path of ['/data/leads.csv', '/leads.json', '/base_mestra_pamda.csv', '/registros_fora_da_area_para_revisar.csv', '/.env.local']) {
    const response = await request.get(path); expect(response.status(), path).toBe(403);
  }
});
