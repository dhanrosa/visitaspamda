import { norm, unique, whatsappUrl, isClient } from './leads.js';

export const emptyFilters = () => ({ search: '', area: '', regional: '', city: '', bairro: '', status: '', contact: '', qualification: '', priority: '', untouched: false, whatsapp: false, clients: false, review: false });
export function matchesRegion(lead, region) {
  return !region || Object.entries(region.match).every(([key, value]) => (Array.isArray(value) ? value : [value]).some(alias => norm(lead[key]) === norm(alias)));
}
export function filterLeads(leads, filters, region = null) {
  const query = norm(filters.search);
  return leads.filter(lead => {
    if (!matchesRegion(lead, region)) return false;
    if (query && !norm([lead.name, lead.address, lead.city, lead.bairro, lead.regional, lead.phone, lead.notes].join(' ')).includes(query)) return false;
    for (const key of ['area', 'regional', 'city', 'bairro', 'status', 'qualification', 'priority']) if (filters[key] && lead[key] !== filters[key]) return false;
    const wa = !!whatsappUrl(lead.whatsapp);
    if ((filters.contact === 'wa' || filters.whatsapp) && !wa) return false;
    if (filters.contact === 'no-wa' && wa) return false;
    if (filters.untouched && lead.status !== 'Não contatado') return false;
    if (filters.clients && !isClient(lead)) return false;
    if (filters.review && !lead.review) return false;
    return true;
  });
}
export function filterOptions(leads, filters) {
  const areaLeads = leads.filter(l => !filters.area || l.area === filters.area);
  const cityLeads = areaLeads.filter(l => !filters.city || l.city === filters.city);
  const regionLeads = cityLeads.filter(l => !filters.regional || l.regional === filters.regional);
  return { area: unique(leads.map(l => l.area)), city: unique(areaLeads.map(l => l.city)), regional: unique(cityLeads.map(l => l.regional)), bairro: unique(regionLeads.map(l => l.bairro)), status: unique(leads.map(l => l.status)), priority: unique(leads.map(l => l.priority)), qualification: unique(leads.map(l => l.qualification)) };
}
