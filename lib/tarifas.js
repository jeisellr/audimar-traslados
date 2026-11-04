// Tarifas de Audimar Traslados. Cambia estos valores para ajustar los precios.
export const TARIFAS = {
  porKmCiudad: 650,     // $ por km en los primeros kilómetros (tramo ciudad)
  kmTramoCiudad: 20,    // hasta cuántos km se cobra la tarifa ciudad
  porKmLargo: 500,      // $ por km desde ese punto (viajes largos / entre ciudades)
  minima: 4000,         // precio mínimo por trayecto
  redondeo: 500,        // el precio se redondea hacia arriba a este múltiplo

  nocheRecargo: 0.20,   // recargo nocturno: 20 % sobre el tramo
  nocheDesde: 22,       // desde las 22:00
  nocheHasta: 6,        // hasta las 06:00

  esperaGratisMin: 5,   // tolerancia: hasta estos minutos la espera no se cobra
  esperaBloqueMin: 10,  // pasada la tolerancia, se cobra cada bloque de 10 min iniciado (6-10: 1 bloque, 11-20: 2 bloques...)
  esperaPorBloque: 2500 // $ por cada bloque de espera adicional
};

// Opciones de espera que puede elegir el cliente (minutos)
export const ESPERAS = [0, 15, 30, 45, 60, 90, 120];

// Zona de servicio: Región de Antofagasta (aprox.), para descartar direcciones fuera de la región.
export const ZONA = { minLat: -26.2, maxLat: -20.9, minLon: -71.0, maxLon: -67.0 };
export const CENTRO = { lat: -23.6509, lon: -70.3975 }; // Antofagasta

const redondear = (n, t) => Math.ceil(n / t.redondeo) * t.redondeo;

export function precioTrayecto(km, t = TARIFAS) {
  const ciudad = Math.min(km, t.kmTramoCiudad) * t.porKmCiudad;
  const largo = Math.max(0, km - t.kmTramoCiudad) * t.porKmLargo;
  return redondear(Math.max(t.minima, ciudad + largo), t);
}

export function esNoche(hora, t = TARIFAS) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || ''));
  if (!m) return false;
  const h = +m[1] + (+m[2]) / 60;
  return t.nocheDesde > t.nocheHasta ? (h >= t.nocheDesde || h < t.nocheHasta) : (h >= t.nocheDesde && h < t.nocheHasta);
}

export function precioEspera(min, t = TARIFAS) {
  const m = Math.max(0, +min || 0);
  if (m <= t.esperaGratisMin) return 0;
  return Math.ceil(m / t.esperaBloqueMin) * t.esperaPorBloque;
}

// Precio completo con desglose
export function calcular({ km, hora, hora2, vuelta, espera }, t = TARIFAS) {
  const base = precioTrayecto(km, t);
  const tramo = h => { const noche = esNoche(h, t); return { base, noche, recargo: noche ? redondear(base * (1 + t.nocheRecargo), t) - base : 0 }; };
  const ida = tramo(hora);
  const reg = vuelta ? tramo(hora2) : null;
  const esp = ESPERAS.includes(+espera) ? +espera : 0;
  const montoEspera = precioEspera(esp, t);
  const total = ida.base + ida.recargo + (reg ? reg.base + reg.recargo : 0) + montoEspera;
  return {
    porTramo: base,
    recargoIda: ida.recargo, nocheIda: ida.noche,
    recargoRegreso: reg ? reg.recargo : 0, nocheRegreso: reg ? reg.noche : false,
    espera: esp, montoEspera, total,
  };
}

export function enZona(p) {
  return p && p.lat >= ZONA.minLat && p.lat <= ZONA.maxLat && p.lon >= ZONA.minLon && p.lon <= ZONA.maxLon;
}
