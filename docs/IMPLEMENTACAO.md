# Refatoração PAMDA

## Arquitetura encontrada
Aplicativo estático: um HTML com estilos, lógica e 1.580 leads embutidos; Leaflet 1.9.4 e MarkerCluster 1.5.3 via CDN. CSV e JSON duplicam a base. Servidor Node apenas para desenvolvimento. Alterações comerciais em localStorage por ID. Exportação antiga não inclui ID. Marcadores são recriados em cada filtro. Lista limitada a 300 sem paginação.

## Etapas e verificações
1. CSV canônico, parser, modelo e filtros puros: verificar IDs, 1.580 registros, ida e volta da exportação, campos vazios, delimitadores e novas cidades.
2. Armazenamento: comparar cada lead com a última versão salva, manter rascunho de recuperação, detectar conflito de arquivo, testar cancelamento/falha de gravação, preservar estado legado.
3. Interface: HTML enxuto, CSS escuro e módulos; edição completa, adição, paginação, resumo filtrado. Verificar carregamento, busca, filtros, mapa e exportação no navegador.
4. Geografia: obter limites oficiais, guardar localmente com procedência; camadas separadas de pins e polígonos, seleção reversível e contadores derivados.
5. Regressão: testes Node, inspeção visual desktop/mobile, logs JavaScript e documentação operacional.

## Riscos tratados
- CSV inválido ou IDs repetidos: importação atômica; nunca substituir a base antes de validar.
- Edições pendentes: indicador, proteção ao sair/trocar base, rascunho explícito de recuperação.
- Exportação não confirma download concluído: pedir confirmação antes de marcar como exportado.
- Arquivo editado por fora: comparar conteúdo antes de gravar; conflito bloqueia sobrescrita.
- localStorage da versão anterior: oferecer migração por ID, sem apagar o original.
- Fronteiras: somente geometrias oficiais, sem inferência por pins.
- Crescimento da base: opções derivadas, lista paginada e atualização de marcadores por ID.

## Arquivos
`index.html`, `src/{app,ui,map,leads,filters,csv,storage}.js`, `src/styles.css`, `data/leads.csv`, `data/*.geojson`, `data/regions.json`, `server.cjs`, `tests/*.test.js`, `README.md`.

CSV é a fonte persistente. localStorage é exclusivamente recuperação de trabalho pendente, não banco de dados. Nenhum backend, login, Supabase, Firebase ou geocodificação.

## Verificações concluídas

- Dados: base canônica comparada aos originais, 1.580 IDs únicos, round-trip de todos os campos e extras, CSV multiline, campos vazios, novas cidades, URLs de contato.
- Persistência: contagem por lead, reversão, recuperação, falha de quota, conflito externo, falha no fechamento, permissão negada e edição durante gravação.
- Geografia: 10 regionais e 28 municípios; geometria municipal idêntica ao retorno do IBGE; anéis fechados, IDs únicos e coordenadas no intervalo EPSG:4326.
- Navegador: filtros cumulativos e regionais, clique direto dentro do polígono para desmarcar, clustering, popup, edição, adição em nova cidade, exportação/reimportação, recuperação após recarregar, troca de arquivo cancelada, exportação não confirmada, CSV inválido, escape de HTML e visualização móvel.
- Acesso a arquivo: testes com handle simulado no navegador, mais testes unitários de erro. O diálogo nativo e as permissões reais dependem do navegador e da escolha do usuário.
- Capturas revisadas em `docs/previews/`: desktop, região selecionada e celular. Corrigidos o crescimento indevido da lista, rotulagem dos campos do editor e a rota do arquivo do MarkerCluster.
- O provedor escuro inicialmente testado retornou imagem exigindo chave. O mapa final usa OpenStreetMap com filtro visual escuro aplicado apenas ao pane das ruas; não altera as cores dos leads.

`npm test`: 14 cenários de dados/persistência/geografia. `npm run test:browser`: 6 cenários de integração, incluindo verificações de erros JavaScript. Sem serviço de aplicação, autenticação ou banco de dados.
