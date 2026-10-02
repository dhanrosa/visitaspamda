// Report startup failures, including opening the app with the obsolete static server.
import('./app.js').catch(() => {
  const error = document.getElementById('loginError');
  const button = document.getElementById('loginSubmit');
  const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  error.textContent = local && location.port === '3000'
    ? 'Este endereço não conseguiu iniciar o sistema. Abra http://127.0.0.1:3001 para entrar.'
    : 'Não foi possível iniciar o sistema. Recarregue a página e verifique sua conexão.';
  error.hidden = false;
  button.disabled = false;
  button.textContent = 'Recarregar página';
  document.getElementById('loginForm').onsubmit = event => event.preventDefault();
  button.type = 'button';
  button.onclick = () => location.reload();
});
