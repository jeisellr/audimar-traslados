import { put, list, get } from '@vercel/blob';
import { cotizar } from '../lib/mapas.js';

const ESTADOS = ['Pendiente', 'Confirmada', 'Realizada', 'Cancelada'];
const FIELDS = ['tipo', 'servicio', 'origen', 'destino', 'fecha', 'hora', 'fecha2', 'hora2',
  'pasajeros', 'equipaje', 'detalle', 'espera', 'nombre', 'telefono', 'correo', 'rut', 'notas'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function clean(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}
function isAdmin(req) {
  const key = process.env.ADMIN_KEY || '';
  const sent = req.headers.get('x-admin-key') || '';
  if (!key || sent.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ sent.charCodeAt(i);
  return diff === 0;
}
async function readOne(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return await new Response(r.stream).json();
}
async function saveOne(o) {
  await put(`reservas/${o.id}.json`, JSON.stringify(o), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
  });
}

// Cliente: crear una solicitud de reserva
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return json({ error: 'Solicitud inválida' }, 400); }
  if (b && b.website) return json({ ok: true, codigo: '------' }, 201); // trampa anti-spam

  const o = {};
  for (const f of FIELDS) o[f] = clean(b[f], f === 'notas' || f === 'detalle' ? 800 : 200);
  o.vuelta = !!b.vuelta;

  const telOk = o.telefono.replace(/\D/g, '').length >= 8;
  if (!['Personas', 'Cargas pequeñas'].includes(o.tipo) || !o.servicio || !o.origen || !o.destino ||
      !/^\d{4}-\d{2}-\d{2}$/.test(o.fecha) || !/^\d{2}:\d{2}$/.test(o.hora) || !o.nombre || !telOk) {
    return json({ error: 'Faltan datos obligatorios' }, 400);
  }
  const now = new Date();
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  o.id = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + rand;
  o.codigo = rand;
  o.creada = now.toISOString();
  o.estado = 'Pendiente';
  o.precio = '';
  o.nota_interna = '';
  // Precio estimado calculado en el servidor (no se confía en el valor que envía el navegador)
  const geo = g => (g && typeof g.lat === 'number' && typeof g.lon === 'number') ? { lat: g.lat, lon: g.lon } : {};
  try {
    const c = await cotizar({
      origen: { texto: o.origen, ...geo(b.origen_geo) },
      destino: { texto: o.destino, ...geo(b.destino_geo) },
      vuelta: o.vuelta, hora: o.hora, hora2: o.hora2, espera: +o.espera || 0,
    });
    if (c.ok) {
      o.km = c.km; o.minutos = c.minutos; o.precio_estimado = c.total;
      o.desglose = { porTramo: c.porTramo, recargoIda: c.recargoIda, recargoRegreso: c.recargoRegreso, espera: c.espera, montoEspera: c.montoEspera };
    }
  } catch { /* sin estimación: la reserva igual se guarda */ }
  await saveOne(o);
  return json({ ok: true, codigo: o.codigo }, 201);
}

// Administración: ver todas las reservas
export async function GET(req) {
  if (!isAdmin(req)) return json({ error: 'No autorizado' }, 401);
  const paths = [];
  let cursor;
  do {
    const r = await list({ prefix: 'reservas/', cursor, limit: 1000 });
    for (const blob of r.blobs) paths.push(blob.pathname);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const all = (await Promise.all(paths.map(p => readOne(p).catch(() => null)))).filter(Boolean);
  all.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return json({ reservas: all });
}

// Administración: cambiar estado, precio o nota
export async function PATCH(req) {
  if (!isAdmin(req)) return json({ error: 'No autorizado' }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ error: 'Solicitud inválida' }, 400); }
  const id = clean(b.id, 60);
  if (!/^[0-9A-Za-z-]+$/.test(id)) return json({ error: 'Id inválido' }, 400);
  const o = await readOne(`reservas/${id}.json`);
  if (!o) return json({ error: 'No encontrada' }, 404);
  if (b.estado !== undefined) {
    if (!ESTADOS.includes(b.estado)) return json({ error: 'Estado inválido' }, 400);
    o.estado = b.estado;
  }
  if (b.precio !== undefined) o.precio = clean(b.precio, 40);
  if (b.nota_interna !== undefined) o.nota_interna = clean(b.nota_interna, 500);
  o.actualizada = new Date().toISOString();
  await saveOne(o);
  return json({ ok: true, reserva: o });
}
