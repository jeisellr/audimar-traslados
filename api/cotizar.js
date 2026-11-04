import { cotizar, sugerencias } from '../lib/mapas.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
const num = v => (typeof v === 'number' && isFinite(v) ? v : undefined);
const punto = p => (p && typeof p === 'object'
  ? { texto: String(p.texto || '').slice(0, 200), lat: num(p.lat), lon: num(p.lon) }
  : { texto: String(p || '').slice(0, 200) });

// GET /api/cotizar?q=texto  -> sugerencias de direcciones
export async function GET(req) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 120);
  if (q.length < 3) return json({ sugerencias: [] });
  try { return json({ sugerencias: await sugerencias(q) }); }
  catch { return json({ sugerencias: [], error: 'sin_servicio' }, 200); }
}

// POST /api/cotizar {origen, destino, vuelta} -> km, minutos y precio estimado
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, motivo: 'solicitud' }, 400); }
  try {
    return json(await cotizar({
      origen: punto(b.origen), destino: punto(b.destino), vuelta: !!b.vuelta,
      hora: String(b.hora || '').slice(0, 5), hora2: String(b.hora2 || '').slice(0, 5), espera: +b.espera || 0,
    }));
  }
  catch { return json({ ok: false, motivo: 'sin_servicio' }); }
}
