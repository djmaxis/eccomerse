/***********************
 *  CONFIGURACIÓN API  *
 ***********************/
export const API_BASE = ""; 
// 👉 Si usas proxy en Vite, deja vacío y llama rutas como "/api/..."
export function apiUrl(path) { return API_BASE ? `${API_BASE}${path}` : path; }

/***********************
 *  AUTH & UTILIDADES  *
 ***********************/
export function hasToken() { return !!localStorage.getItem('token'); }
export function getToken() { return localStorage.getItem('token'); }
export function getNombre() { return localStorage.getItem('nombre') || ''; }
export function getCorreo() { return localStorage.getItem('correo') || ''; }
export function isLoggedIn() { return hasToken(); }

export function getIniciales(nombre) {
  if (!nombre) return 'US';
  const parts = nombre.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'US';
}

export function formatNumber(number, decimals = 0) {
  return Number(number).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Normaliza claves del backend a un formato consistente para el frontend
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
