// Conversão reprodutível; executado manualmente, nunca pelo navegador.
import { readFile, writeFile } from 'node:fs/promises';
import { norm } from '../src/leads.js';
const read = async file => JSON.parse(await readFile(new URL('../data/' + file, import.meta.url), 'utf8'));
const write = async (file, data) => writeFile(new URL('../data/' + file, import.meta.url), JSON.stringify(data));
const config = await read('rmc-config.json');
const regions = await read('curitiba-regionais.geojson');
for (const feature of regions.features) {
  const p = feature.properties;
  if (p.match) { p.match.regional = config.regionalAliases?.[p.name] || p.name; continue; }
  feature.properties = { id: `regional-${p.codigo}`, name: p.nome, kind: 'Regional', source: 'IPPUC / GeoCuritiba', legislation: p.fonte, match: { city: config.capital, regional: config.regionalAliases?.[p.nome] || p.nome } };
}
await write('curitiba-regionais.geojson', regions);
const municipalities = await read('ibge-municipios-pr.json');
const names = new Map(municipalities.map(m => [String(m.id), m.nome]));
const included = new Set(config.municipalities.map(norm));
const state = await read('pr-municipios-fonte.geojson');
const features = state.features.filter(f => {
  const name = names.get(String(f.properties.codarea));
  return name && included.has(norm(name)) && norm(name) !== norm(config.capital);
}).map(f => { const name = names.get(String(f.properties.codarea)); return { ...f, properties: { id: `municipio-${f.properties.codarea}`, name, kind: 'Município', source: 'IBGE / API de malhas', code: f.properties.codarea, match: { city: config.cityAliases?.[name] || name } } }; });
if (features.length !== config.municipalities.length - 1) throw new Error('Quantidade inesperada de municípios; confira os dados oficiais.');
await write('rmc-municipios.geojson', { type: 'FeatureCollection', features });
console.log(`${regions.features.length} regionais e ${features.length} municípios; coordenadas oficiais preservadas.`);
