import { STATUS_COLORS, coordinate, hasCoordinates, whatsappUrl, mapsUrl } from './leads.js';

const colors = ['#709687', '#7b8eac', '#a29878', '#8b86a6', '#7a9c9f', '#8b9c78', '#a18487', '#6f8e80'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createMap(onEdit, onRegion, onMessage) {
  if (!window.L || !L.markerClusterGroup) {
    document.getElementById('map').innerHTML = '<div class="map-error">Não foi possível carregar o mapa. Recarregue a página. Sua base continua disponível na lista.</div>';
    return { sync() {}, fit() {}, focus() {}, setRegion() {}, invalidate() {}, regions: [] };
  }
  const map = L.map('map', { zoomControl: false, preferCanvas: true, minZoom: 2 }).setView([0, 0], 2);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.createPane('darkBase'); map.getPane('darkBase').style.zIndex = 200;
  map.getPane('darkBase').classList.add('dark-base-tiles');
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    pane: 'darkBase', maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  }).addTo(map);
  let tileWarned = false;
  tiles.on('tileerror', () => { if (!tileWarned) { tileWarned = true; onMessage('Alguns mapas-base não carregaram. Verifique sua conexão; leads e regiões continuam disponíveis.'); } });
  map.createPane('regions'); map.getPane('regions').style.zIndex = 350;
  const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48, disableClusteringAtZoom: 18, animate: false,
    iconCreateFunction(group) {
      const count = group.getChildCount(), size = count > 100 ? 48 : count > 20 ? 40 : 33;
      return L.divIcon({ html: `<span>${count}</span>`, className: 'pamda-cluster', iconSize: [size, size] });
    },
  }).addTo(map);
  const markers = new Map(), regions = [], regionLayers = new Map();
  let active = null;
  function icon(status) {
    return L.divIcon({ className: 'pamda-pin', html: `<i style="--pin:${STATUS_COLORS[status] || '#91a0ad'}"></i>`, iconSize: [18, 18], iconAnchor: [9, 9] });
  }
  function popup(lead) {
    const div = document.createElement('div');
    const wa = whatsappUrl(lead.whatsapp);
    div.innerHTML = `<span class="eyebrow">PONTO DE PROSPECÇÃO</span><h3>${esc(lead.name || 'Sem nome')}</h3><p>${esc([lead.bairro, lead.city].filter(Boolean).join(' · '))}</p><p>${esc(lead.address || 'Endereço não informado')}</p><p class="popup-status">${esc(lead.status)}</p><div class="popup-actions">${wa ? `<a class="wa" href="${wa}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>` : ''}<a href="${esc(mapsUrl(lead))}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a><button type="button">Editar lead</button></div>`;
    div.querySelector('button').addEventListener('click', () => onEdit(lead.id));
    return div;
  }
  function sync(leads) {
    const valid = new Map(leads.filter(hasCoordinates).map(l => [l.id, l]));
    const remove = [], add = [];
    for (const [id, item] of markers) if (!valid.has(id)) { remove.push(item.marker); markers.delete(id); }
    for (const [id, lead] of valid) {
      const signature = JSON.stringify(lead), old = markers.get(id);
      if (old?.signature === signature) continue;
      if (old && old.lat === coordinate(lead.lat) && old.lon === coordinate(lead.lon)) {
        old.marker.setIcon(icon(lead.status)); old.marker.setPopupContent(popup(lead)); old.signature = signature;
        old.marker.options.title = lead.name; old.marker.getElement()?.setAttribute('title', lead.name);
      } else {
        if (old) remove.push(old.marker);
        const marker = L.marker([coordinate(lead.lat), coordinate(lead.lon)], { icon: icon(lead.status), title: lead.name, alt: lead.name || 'Lead' }).bindPopup(popup(lead), { maxWidth: 285 });
        markers.set(id, { marker, signature, lat: coordinate(lead.lat), lon: coordinate(lead.lon) }); add.push(marker);
      }
    }
    if (remove.length) cluster.removeLayers(remove);
    if (add.length) cluster.addLayers(add);
  }
  function style(region, hover = false) {
    const selected = active?.id === region.id;
    return { color: selected ? '#7bd6a1' : region.color, weight: selected || hover ? 2 : 1, opacity: selected || hover ? .95 : .62, fillColor: region.color, fillOpacity: selected ? .23 : hover ? .18 : .065 };
  }
  function setRegion(region, fit = false) {
    active = region;
    for (const r of regions) regionLayers.get(r.id).setStyle(style(r));
    if (fit && region) map.fitBounds(regionLayers.get(region.id).getBounds(), { padding: [35, 35], maxZoom: 14 });
  }
  async function loadRegions() {
    try {
      const response = await fetch('./data/regions.json'); if (!response.ok) throw new Error('Catálogo de regiões indisponível');
      const catalog = await response.json();
      for (const entry of catalog) {
        try {
          const response = await fetch(entry.file); if (!response.ok) throw new Error(entry.label);
          const geo = await response.json();
          if (geo.type !== 'FeatureCollection') throw new Error('GeoJSON inválido');
          L.geoJSON(geo, { pane: 'regions', smoothFactor: 0.5,
            filter: f => ['Polygon', 'MultiPolygon'].includes(f.geometry?.type) && f.properties?.match && f.properties?.id,
            onEachFeature(feature, layer) {
              const region = { ...feature.properties, color: colors[regions.length % colors.length] };
              regions.push(region); regionLayers.set(region.id, layer); layer.setStyle(style(region));
              const label = document.createElement('span'); label.textContent = `${region.kind} · ${region.name}`;
              layer.bindTooltip(label, { sticky: true, className: 'region-tooltip' });
              layer.on({ mouseover: () => layer.setStyle(style(region, true)), mouseout: () => layer.setStyle(style(region)), click: () => onRegion(active?.id === region.id ? null : region) });
            },
          }).addTo(map);
        } catch { onMessage(`Limites de ${entry.label} indisponíveis. Confira o GeoJSON local.`); }
      }
    } catch { onMessage('Limites geográficos indisponíveis. O mapa de leads continua funcionando.'); }
    return regions;
  }
  return { regions, loadRegions, sync, setRegion,
    fit() { const bounds = cluster.getBounds(); if (bounds.isValid()) map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 }); },
    focus(id) { const marker = markers.get(id)?.marker; if (!marker) return false; cluster.zoomToShowLayer(marker, () => marker.openPopup()); map.setView(marker.getLatLng(), Math.max(map.getZoom(), 17)); return true; },
    invalidate() { map.invalidateSize(); },
  };
}
