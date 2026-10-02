# Procedência dos limites geográficos

Obtenção em 01/10/2026. Nenhuma consulta de limites é feita em tempo de uso do site.

## Regionais

- Órgão: IPPUC / Prefeitura de Curitiba, GeoCuritiba.
- Serviço oficial: https://geocuritiba.ippuc.org.br/server/rest/services/Hosted/REGIONAL/FeatureServer/0
- Consulta utilizada: https://geocuritiba.ippuc.org.br/server/rest/services/Hosted/REGIONAL/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson
- Saída: `curitiba-regionais.geojson`, 10 polígonos. As coordenadas retornadas pelo serviço foram preservadas, em longitude/latitude WGS84 (EPSG:4326).
- Atributo de fonte das feições: Decreto Municipal 844 / 2018. O serviço não fornece descrição/licença específica; os arquivos têm origem no serviço público oficial. Não representam levantamento novo ou certificação cadastral.
- Apenas propriedades foram normalizadas para `id`, `name`, `kind`, `source`, `legislation` e `match`. Metadados de usuários técnicos do serviço foram retirados.

## Municípios da RMC

- Órgão: IBGE, API de malhas geográficas v3.
- Consulta utilizada, com versão padrão da API na data da obtenção: https://servicodados.ibge.gov.br/api/v3/malhas/estados/41?formato=application/vnd.geo%2Bjson&intrarregiao=municipio
- Documentação: https://servicodados.ibge.gov.br/api/docs/malhas?versao=3
- Nomes e códigos: https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios
- Composição da RMC: https://www.amep.pr.gov.br/Pagina/Sobre-RM-de-Curitiba
- A API fornece **malhas simplificadas oficiais**, destinadas à visualização web. O recorte preserva integralmente as coordenadas retornadas, sem simplificação adicional no arquivo e sem inventar fronteiras. Não usar para medição ou demarcação cadastral.
- Saída: `rmc-municipios.geojson`, 28 municípios. Curitiba é representada pelas suas 10 regionais, evitando sobreposição de uma camada municipal sobre a regional.
- Os arquivos `pr-municipios-fonte.geojson` e `ibge-municipios-pr.json` preservam os insumos da conversão. `scripts/prepare-geography.js` reproduz o recorte segundo `rmc-config.json`.

## Relação com a planilha

A seleção usa as colunas da base (`match`), não reclassifica lojas pelas coordenadas. Essa escolha preserva a organização comercial da planilha e permite corrigir a regional pelo editor. Um ponto com coordenadas ou classificação incorretas pode estar fora do contorno selecionado; use a marcação Revisar.

Dois vínculos de nomenclatura da base original estão explícitos em `rmc-config.json`:
- A categoria comercial legada `CENTRO` é incluída na seleção `MATRIZ`, junto ao nome oficial. É um vínculo de categoria para compatibilidade, não afirmação de que cada ponto foi conferido espacialmente.
- `Alm. Tamandaré` é aceito junto com `Almirante Tamandaré`.

Os valores e coordenadas dos 1.580 leads não foram alterados. A seleção Tatuquara pode mostrar zero enquanto a planilha não classificar leads nessa regional.

## Acrescentar regiões no futuro

1. Obtenha GeoJSON oficial/confiável em EPSG:4326. Reprojete arquivos UTM antes de usá-los. Não renomeie um shapefile como GeoJSON.
2. Salve o arquivo em `data/` e registre uma entrada em `regions.json`, com `file`, `label` e `source`.
3. Cada Feature precisa de geometria Polygon/MultiPolygon real e das propriedades abaixo:

```json
{
  "id": "municipio-codigo-oficial",
  "name": "Nome oficial",
  "kind": "Município",
  "source": "Órgão e edição",
  "match": { "city": "Nome presente na coluna Cidade" }
}
```

Para regionais, inclua também `regional` e `city` em `match`. Valores podem ser listas de aliases. `area` pode ser acrescentada para distinguir cidades homônimas entre estados. Todos os campos de `match` devem corresponder ao mesmo lead. Os nomes são comparados sem diferença de acento/maiúsculas.

4. Registre URL, órgão, data de obtenção, edição/escala conhecida e licença neste documento.
5. Execute `npm test`, confira posicionamento no mapa e comparação com a publicação oficial. Filtros da planilha funcionam mesmo sem polígonos para as novas cidades.

Se faltar um arquivo, a aplicação informa que seus limites estão indisponíveis e mantém leads, filtros e exportação operantes. Nunca cria fronteiras substitutas.
