# Publicação preparada

Esta cópia tem histórico novo, sem CSVs de lojas, `leads.json`, capturas antigas ou `.env.local`. O projeto original e seu histórico permaneceram intactos. Os testes usam dados fictícios. O OpenSSL foi configurado somente neste repositório, com verificação HTTPS ativa.

Validação: 17 testes de módulos, build e verificação de segurança passaram sem depender das bases privadas.

O envio não foi concluído porque a conexão HTTPS com github.com apresentou certificado de mediarouter.home. Corrija a rede ou use outra conexão antes de enviar. Não desative a validação dos certificados.

Partindo da pasta original, envie somente esta cópia:

```powershell
git -c 'safe.directory=D:/SITE LEADS/mapa pamda/.tmp/publicacao-github' -C .tmp/publicacao-github push origin main
```

Se o remoto já tiver commits e recusar o envio, revise o histórico remoto; não use force automaticamente. Não envie a main do repositório original, pois ela ainda contém bases privadas no histórico.

Para continuar trabalhando após publicar, prefira clonar novamente o repositório limpo em uma pasta permanente. Esta cópia fica dentro de `.tmp`; preserve-a até concluir a publicação.

Para rodar ou publicar a aplicação, configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente local ou da hospedagem. Credenciais reais não foram copiadas para este repositório. Publique somente dist após um build com essas variáveis configuradas.
