import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCSV } from '../src/csv.js';
import { filterLeads, emptyFilters } from '../src/filters.js';
const read = async f => JSON.parse(await readFile('data/' + f, 'utf8'));
test('GeoJSONs locais possuem polígonos válidos em longitude/latitude e IDs únicos', async () => {
  const catalog = await read('regions.json'); const ids = new Set();
  for (const item of catalog) {
    const geo = JSON.parse(await readFile(item.file, 'utf8')); assert.equal(geo.type, 'FeatureCollection');
    for (const f of geo.features) {
      assert.ok(!ids.has(f.properties.id)); ids.add(f.properties.id);
      assert.ok(f.properties.source); assert.ok(f.properties.match);
      assert.ok(['Polygon', 'MultiPolygon'].includes(f.geometry.type));
      const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const polygon of polygons) for (const ring of polygon) {
        assert.ok(ring.length >= 4); assert.deepEqual(ring[0], ring.at(-1));
        for (const [lon, lat] of ring) { assert.ok(lon >= -180 && lon <= 180); assert.ok(lat >= -90 && lat <= 90); }
      }
    }
  }
  assert.equal(ids.size, 38);
});
test('municípios mantêm exatamente a geometria obtida do IBGE', async () => {
  const source = await read('pr-municipios-fonte.geojson'); const local = await read('rmc-municipios.geojson');
  assert.equal(local.features.length, 28);
  for (const feature of local.features) assert.deepEqual(feature.geometry, source.features.find(f => f.properties.codarea === feature.properties.code).geometry);
});
test('seleção por região e nomes legados reflete a base, sem totais fixos na aplicação', async () => {
  const leads = parseCSV('ID;Nome;Área;Cidade;Regional\na;Loja fictícia A;Curitiba;Curitiba;CENTRO\nb;Loja fictícia B;Curitiba;Curitiba;MATRIZ\nc;Loja fictícia C;RMC;Almirante Tamandaré;\nd;Loja fictícia D;RMC;Pinhais;').leads;
  const regionals = await read('curitiba-regionais.geojson');
  const matriz = regionals.features.find(f => f.properties.name === 'MATRIZ').properties;
  assert.equal(filterLeads(leads, emptyFilters(), matriz).length, leads.filter(l => l.city === 'Curitiba' && ['CENTRO', 'MATRIZ'].includes(l.regional)).length);
  const municipalities = await read('rmc-municipios.geojson');
  const municipality = municipalities.features.find(f => f.properties.name === 'Almirante Tamandaré').properties;
  assert.equal(filterLeads(leads, emptyFilters(), municipality).length, 1);
});
