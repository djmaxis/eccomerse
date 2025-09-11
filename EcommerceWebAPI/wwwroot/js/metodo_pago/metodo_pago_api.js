// wwwroot/js/metodo_pago/metodo_pago_api.js
// Módulo ES: exporta funciones CRUD para ClienteMetodoPago

// === Fallbacks si no existen utils globales ===
function _apiUrl(path) {
  return path.startsWith('http') ? path : `${path}`;
}
function _getAuthHeaders() {
  const token = localStorage.getItem('token') || '';
  const clienteId = localStorage.getItem('clienteId') || '1';
  const h = { 'Content-Type': 'application/json', 'X-Cliente-Id': clienteId };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

const base = '/api/clientes'; // => /api/clientes/{idCliente}/metodos-pago

export async function apiListMetodos(clienteId) {
  const url = _apiUrl(`${base}/${clienteId}/metodos-pago`);
  const res = await fetch(url, { headers: _getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`GET metodos ${res.status}`);
  return await res.json();
}

export async function apiCreateMetodo(clienteId, payload) {
  const url = _apiUrl(`${base}/${clienteId}/metodos-pago`);
  const res = await fetch(url, {
    method: 'POST',
    headers: _getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `POST metodos ${res.status}`);
  return data;
}

export async function apiUpdateMetodo(clienteId, idMetodo, payload) {
  const url = _apiUrl(`${base}/${clienteId}/metodos-pago/${idMetodo}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: _getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PUT metodos ${res.status}`);
  return data;
}

export async function apiDeleteMetodo(clienteId, idMetodo) {
  const url = _apiUrl(`${base}/${clienteId}/metodos-pago/${idMetodo}`);
  const res = await fetch(url, { method: 'DELETE', headers: _getAuthHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `DELETE metodos ${res.status}`);
  }
  return true;
}
