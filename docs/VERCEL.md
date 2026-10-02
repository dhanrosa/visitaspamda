# Publicar Pamda B2B na Vercel

O projeto é estático, usa Vite e consulta Supabase diretamente após login. `vercel.json` configura a instalação com `npm ci`, o build e a verificação de segurança, e publica somente `dist`. Não é necessário servidor Node em produção nem configuração de rotas para o mapa.

## Configuração no painel

1. Importe o repositório GitHub que contém a cópia limpa do projeto ou abra o projeto já conectado.
2. Use a branch `main` como Production Branch.
3. Deixe Root Directory na raiz do repositório. Não selecione `src`, `dist` nem `.tmp/publicacao-github`: o conteúdo da cópia limpa é publicado na raiz do GitHub.
4. Selecione Node.js **24.x** nas configurações. Framework, comandos e diretório de saída estão definidos em `vercel.json`.
5. Em Settings → Environment Variables, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para Production e Preview. Copie os valores da configuração local sem publicá-los no Git. Use somente chave `sb_publishable_…`; nunca `service_role` ou chave secreta.
6. Gere um novo deployment depois de configurar as variáveis. Elas são incorporadas durante o build; salvar variáveis não altera um build anterior.
7. Em Deployments, aguarde **Ready**. Se o deployment for Preview, use Promote to Production para colocá-lo em produção. Confira o endereço pelo botão Visit e a associação do domínio em Settings → Domains.

O build na Vercel agora falha com uma mensagem clara se as duas variáveis obrigatórias não estiverem configuradas, evitando publicar um login sem conexão.

## Enviar a cópia limpa

A pasta original possui histórico antigo com dados privados. A cópia preparada em `.tmp/publicacao-github` contém apenas código, dados geográficos públicos e testes fictícios. Para enviar essa cópia, execute a partir da pasta original:

```powershell
git -c 'safe.directory=D:/SITE LEADS/mapa pamda/.tmp/publicacao-github' -C .tmp/publicacao-github push origin main
```

Não use `--force` se o remoto rejeitar o envio por conter outros commits. Nesse caso, revise o histórico antes de conciliá-lo. Caso a conexão apresente certificado `mediarouter.home` ao acessar GitHub, corrija a rede ou use outra conexão; não desative a verificação HTTPS.

## Testar após publicar

Abra o endereço de produção em janela anônima. Confira login, leitura das lojas, busca, filtros e mapa. Edite uma loja de teste, recarregue para confirmar a persistência, e faça logout. As políticas RLS existentes de SELECT/UPDATE para authenticated continuam obrigatórias.

`DEPLOYMENT_NOT_FOUND` indica que a Vercel não encontrou o deployment solicitado. A configuração do código não cria uma publicação no painel: é necessário um deployment válido associado ao domínio.

Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json), [DEPLOYMENT_NOT_FOUND](https://vercel.com/docs/errors/deployment_not_found).
