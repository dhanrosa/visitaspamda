# PAMDA | Mapa B2B

Aplicação interna de prospecção em JavaScript puro, Leaflet e MarkerCluster. Vite serve o desenvolvimento e gera a publicação. A fonte de lojas é `public.lojas` no Supabase; busca, filtros, indicadores e paginação de 40 itens continuam no navegador. Limites IPPUC/IBGE são arquivos cartográficos locais.

## Iniciar

Node.js 22.12+ ou 24+.

```powershell
npm install
```

Se `.env.local` ainda não existir, copie `.env.example` para `.env.local` e configure:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use a URL do projeto e a chave pública `sb_publishable_…`. Nunca use chave secreta ou `service_role`. A conexão pública entra no frontend; Supabase Auth e RLS protegem os dados. Reinicie Vite após mudar as variáveis.

```powershell
npm run dev
```

Abra http://127.0.0.1:3000. Para outra porta: `$env:PORT = '3001'`. O antigo `server.cjs` foi desativado porque expunha bases locais e não processava a configuração Vite.

## Login e dados

Use e-mail e senha de um usuário já criado no Supabase Auth. Não há cadastro público. A sessão é persistida pelo SDK e renovada automaticamente. Logout encerra a sessão deste navegador e limpa base em memória, formulário e marcadores; outros dispositivos continuam com suas sessões.

Mantenha RLS e as políticas existentes de SELECT e UPDATE para `authenticated`. Não são necessários INSERT ou DELETE. O aplicativo não modifica políticas, tabelas ou usuários.

As lojas são lidas em páginas ordenadas por `id`, respeitando limites inferiores a 500. A base autenticada fica em memória, sem cópia de leads no localStorage. Busca e filtros não fazem consultas. **Atualizar lojas** lê novamente o banco; **Exportar base** baixa uma cópia CSV da base autenticada inteira.

O adaptador em `src/services/lojas.js` identifica aliases como `nome/name`, `cidade/city`, `endereco/address`, `telefone/phone` e `observacoes/notes`. IDs continuam textos; campos extras são preservados na exportação. Campos do formulário ausentes na tabela ficam desabilitados. Para nomes ainda não reconhecidos, acrescente aliases nesse arquivo. A inspeção das colunas reais depende de uma sessão autenticada.

Editar uma loja ou mudar status na lista executa UPDATE pelo ID e só confirma o estado local após receber a linha salva. Falha mantém os valores no formulário; sessão inválida retorna ao login e limpa dados. Não há inclusão ou exclusão. Importação CSV, recuperação de rascunhos e gravação em arquivo deixaram o fluxo principal por dependerem da base local e de operações fora das políticas atuais. Os módulos e arquivos antigos foram preservados.

## Validação

```powershell
npm test
npm run test:browser
npm run build
npm run test:security
```

Não existe comando de lint configurado. Testes de navegador usam Chrome e Vite na porta 3173, com dados fictícios e respostas Supabase simuladas. Não alteram registros reais. Os testes antigos de CSV, geografia e armazenamento continuam verificando módulos preservados.

Para validar com o projeto real:

1. Abra em janela anônima: somente login. Tente senha incorreta e confira a mensagem amigável.
2. Entre com o usuário existente: confira quantidade, nomes, busca, cidades/bairros, filtros e marcadores.
3. Recarregue: a sessão válida deve continuar aberta.
4. Edite observações ou status de uma loja de teste. Salve, recarregue e confira a persistência no aplicativo e painel Supabase.
5. Clique **Sair**: lojas e edição deixam de aparecer. Recarregue para confirmar que continua no login.
6. Sem autenticação, a tabela deve bloquear a leitura ou retornar nenhuma linha por RLS. As políticas do servidor são a proteção efetiva.

## Publicação e Git

Publique **somente `dist/`**, gerado por `npm run build`, em hospedagem estática HTTPS. Para conferir localmente: `npm run preview`. Configure as duas variáveis públicas no ambiente de build. Não publique a raiz do projeto.

O build inclui HTML, código, estilos, Leaflet e os três arquivos cartográficos permitidos; não copia `data/` inteira. Vite bloqueia CSVs, `leads.json`, `.env`, Git, testes e documentos no desenvolvimento. O teste de segurança verifica arquivos privados, credenciais privilegiadas, sourcemaps e dependência do CSV no build.

**Antes de enviar ao GitHub:** estes arquivos privados já estão rastreados; `.gitignore` não os remove do índice nem do histórico:

- `data/leads.csv`
- `base_mestra_pamda.csv`
- `leads.json`
- `registros_fora_da_area_para_revisar.csv`

Nenhuma remoção do índice ou reescrita de histórico foi executada. Revise antes de publicar. Os quatro podem ser retirados da aplicação após validar a migração real, mas os testes antigos de dados/geografia ainda usam o CSV e a base mestra como fixtures. `docs/IMPLEMENTACAO.md` descreve a arquitetura CSV histórica.

Rascunhos antigos eventualmente presentes no navegador não são importados automaticamente. Guarde-os para auditoria se houver edições ainda não transferidas ao banco.

## Arquivos da integração

- Criados: `src/lib/supabase.js`, `src/services/lojas.js`, `vite.config.js`, `.env.example`, `scripts/check-build.js`, `tests/lojas.test.js`.
- Modificados: `src/app.js`, `index.html`, `src/styles.css`, `package.json`, `package-lock.json`, `.gitignore`, `server.cjs`, `playwright.config.js`, `tests/browser/app.spec.js`, `README.md`.

Mapa-base OpenStreetMap; limites e seleção em [data/SOURCES.md](data/SOURCES.md). Sessão conforme a [documentação Supabase](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

Build validado também em produção com respostas simuladas (login/sessão, leitura, filtros, mapa, UPDATE e celular). A consulta ao projeto Supabase real não teve conexão disponível nesta sessão; a validação autenticada real permanece pendente. Vite emite avisos sobre os scripts Leaflet copiados separadamente e imagens de ícones padrão ausentes; os marcadores personalizados usados pelo sistema foram verificados no desenvolvimento e no build. O build conclui sem erros.
