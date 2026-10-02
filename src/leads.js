export const STATUS_COLORS = {
  'Não contatado': '#91a0ad', 'Contato realizado': '#67a7ee',
  'Respondeu': '#e5c16a', 'Interessado / demonstração': '#ae91ea',
  'Primeiro pedido': '#a3d874', 'Cliente recorrente': '#40c8a0',
  'Cliente ativo': '#20a15e', 'Não interessado': '#da8080',
};
export const STATUSES = Object.keys(STATUS_COLORS);
export const PRIORITIES = ['Baixa', 'Normal', 'Alta', 'Urgente'];
export const QUALIFICATIONS = ['Pendente', 'Qualificado', 'Não qualificado'];
export const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
export const newId = () => globalThis.crypto.randomUUID();
export function coordinate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}
export function hasCoordinates(lead) {
  const lat = coordinate(lead.lat), lon = coordinate(lead.lon);
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}
export function whatsappUrl(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  if (/^https?:/i.test(text)) {
    try {
      const url = new URL(text);
      if (url.hostname === 'wa.me') text = url.pathname.slice(1);
      else if (['api.whatsapp.com', 'web.whatsapp.com'].includes(url.hostname)) text = url.searchParams.get('phone') || '';
      else return '';
    } catch { return ''; }
  }
  if (!/^[+\d\s().-]+$/.test(text)) return '';
  let digits = text.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : '';
}
export const isClient = lead => ['Primeiro pedido', 'Cliente recorrente', 'Cliente ativo'].includes(lead.status);
export function mapsUrl(lead) {
  const query = hasCoordinates(lead) ? `${coordinate(lead.lat)},${coordinate(lead.lon)}` : [lead.name, lead.address, lead.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${lead.place_id ? `&query_place_id=${encodeURIComponent(lead.place_id)}` : ''}`;
}
export function stats(leads) {
  return {
    total: leads.length, whatsapp: leads.filter(l => whatsappUrl(l.whatsapp)).length,
    untouched: leads.filter(l => l.status === 'Não contatado').length,
    interested: leads.filter(l => l.status === 'Interessado / demonstração').length,
    replied: leads.filter(l => l.status === 'Respondeu').length,
    clients: leads.filter(isClient).length,
    unmapped: leads.filter(l => !hasCoordinates(l)).length,
  };
}
export function emptyLead() {
  return { id: newId(), name: '', area: '', regional: '', city: '', bairro: '', address: '', phone: '', whatsapp: '', lat: '', lon: '', place_id: '', status: STATUSES[0], priority: 'Normal', qualification: 'Pendente', last_contact: '', next_action: '', notes: '', review: false, review_reason: '', extra: {} };
}
