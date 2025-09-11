/***********************
 *  CONFIGURACIÓN API  *
 *  (Opción 1: mismo origen - ASP.NET sirve wwwroot + API)
 ***********************/
export const API_BASE = ""; // MISMO ORIGEN. No poner puertos aquí.
export function apiUrl(path) { return path; } // '/api/...'

/***********************
 *  AUTH & UTILIDADES  *
 ***********************/
export function hasToken() { return !!localStorage.getItem('token'); }
export function getToken() { return localStorage.getItem('token'); }
export function getNombre() { return localStorage.getItem('nombre') || ''; }
export function getCorreo() { return localStorage.getItem('correo') || ''; }
export function getClienteId() { return localStorage.getItem('clienteId') || ''; }
export function isLoggedIn() { return hasToken(); }

/**
 * Cabeceras comunes.
 * - withJson=true incluye Content-Type JSON.
 * - Incluye X-Cliente-Id (mientras no uses JWT real en backend).
 * - Incluye Authorization si existe token.
 */
export function authHeaders(withJson = true) {
  const h = {};
  if (withJson) h['Content-Type'] = 'application/json';

  const cid = getClienteId();
  if (cid) h['X-Cliente-Id'] = String(cid);

  const tok = getToken();
  if (tok) h['Authorization'] = `Bearer ${tok}`; // opcional si tu backend lo procesa
  return h;
}

/** Iniciales para avatar textual */
export function getIniciales(nombre) {
  if (!nombre) return 'US';
  const parts = nombre.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'US';
}

/** Formateo de número */
export function formatNumber(value, decimals = 2) {
  const v = Number(value ?? 0);
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function money(value) {
  // Si quieres mostrar con $: return '$' + formatNumber(value, 2);
  return formatNumber(value, 2); // ← sin símbolo, ejemplo: 1,000.00
}

/** Normaliza un producto del backend a un objeto usable en el front */
export function normalizeProduct(p) {
  const nombre = p.Nombre ?? p.nombre ?? p.Name ?? p.name ?? '';
  const descripcion = p.Descripcion ?? p.descripcion ?? p.description ?? '';
  const precio = Number(p.Precio ?? p.precio ?? p.Price ?? p.price ?? 0);
  const stock = Number(p.Stock ?? p.stock ?? 0);
  const activoRaw = p.Activo ?? p.activo;
  const activo = Number(
    activoRaw === true ? 1 :
    activoRaw === false ? 0 :
    activoRaw ?? 0
  );

  const ref = p.RefModelo ?? p.refModelo ?? p.refmodelo ?? p.Ref ?? p.ref ?? p.IdProducto ?? p.id ?? '';
  const image = p.image ?? p.Image ?? p.imagen ?? p.urlImagen ?? 'img/placeholder.jpg';
  const id = Number(p.IdProducto ?? p.id ?? 0);

  return { id, ref, name: nombre, description: descripcion, price: precio, stock, activo, image };
}

/**
 * Fetch seguro que NO revienta si la respuesta no tiene JSON (p. ej., 404 sin body).
 * Devuelve siempre: { ok, status, data }
 */
export async function fetchJsonSafe(url, options = {}) {
  const res = await fetch(url, options);
  let data = null;
  try {
    const ct = res.headers.get('content-type') || '';
    data = ct.includes('application/json') ? await res.json() : null;
  } catch { /* respuesta vacía o no JSON */ }
  return { ok: res.ok, status: res.status, data };
}
