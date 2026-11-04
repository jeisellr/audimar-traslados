// Búsqueda de direcciones (Photon / OpenStreetMap) y cálculo de ruta (OSRM).
import { ZONA, CENTRO, enZona, calcular } from './tarifas.js';

const UA = 'AudimarTraslados/1.0 (reservas)';

async function getJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function etiqueta(p) {
  const x = p.properties || {};
  const calle = [x.name && x.name !== x.street ? x.name : '', x.street ? (x.street + (x.housenumber ? ' ' + x.housenumber : '')) : '']
    .filter(Boolean).join(', ');
  const lugar = x.district || x.locality || x.city || x.county || '';
  return [calle || x.name || '', lugar && !calle.includes(lugar) ? lugar : ''].filter(Boolean).join(', ');
}

export async function sugerencias(q) {
  const bbox = [ZONA.minLon, ZONA.minLat, ZONA.maxLon, ZONA.maxLat].join(',');
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=default&lat=${CENTRO.lat}&lon=${CENTRO.lon}&bbox=${bbox}`;
  const j = await getJson(url);
  const vistos = new Set();
  return (j.features || [])
    .map(f => ({ texto: etiqueta(f), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }))
    .filter(s => s.texto && enZona(s) && !vistos.has(s.texto) && vistos.add(s.texto));
}

export async function geocodificar(texto) {
  const lista = await sugerencias(/antofagasta|mejillones|calama|tocopilla|taltal|baquedano|juan l[oó]pez/i.test(texto) ? texto : texto + ', Antofagasta');
  return lista[0] || null;
}

async function puntoDe(p) {
  if (p && typeof p.lat === 'number' && typeof p.lon === 'number' && enZona(p)) return p;
  const texto = String((p && p.texto) || '').trim();
  if (!texto) return null;
  return await geocodificar(texto);
}

export async function cotizar({ origen, destino, vuelta, hora, hora2, espera }) {
  const a = await puntoDe(origen);
  if (!a) return { ok: false, motivo: 'origen' };
  const b = await puntoDe(destino);
  if (!b) return { ok: false, motivo: 'destino' };
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false`;
  const j = await getJson(url);
  const ruta = j.routes && j.routes[0];
  if (!ruta) return { ok: false, motivo: 'ruta' };
  const km = Math.round(ruta.distance / 100) / 10;
  const minutos = Math.max(1, Math.round(ruta.duration / 60));
  const p = calcular({ km, hora, hora2, vuelta: !!vuelta, espera });
  return { ok: true, km, minutos, vuelta: !!vuelta, ...p, origen: a, destino: b };
}
