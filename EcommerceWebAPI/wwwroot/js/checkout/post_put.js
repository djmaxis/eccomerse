// wwwroot/js/checkout/post_put.js
// POST /api/postput/orden  -> crea Orden, Items, Factura, FacturaItems, Pago
// PUT  /api/postput/productos/stock -> descuenta stock
// PUT  /api/postput/carrito/cerrar/{id} -> cierra carrito
// Limpia carrito local y redirige a index.html

(function () {
  function getAuthHeaders(withJson = true) {
    const h = {};
    const token = localStorage.getItem('token') || '';
    const cid   = localStorage.getItem('clienteId') || '';
    if (withJson) h['Content-Type'] = 'application/json';
    if (cid) h['X-Cliente-Id'] = cid;
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async function fetchJsonOrText(url, init) {
    const res = await fetch(url, init);
    const ct = res.headers.get('content-type') || '';
    let payload = null;
    try {
      if (ct.includes('application/json')) payload = await res.json();
      else payload = await res.text();
    } catch {
      payload = null;
    }
    return { ok: res.ok, status: res.status, data: payload };
  }

  function setFeedback(msg, type = 'info') {
    const el = document.getElementById('checkout-feedback');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = type === 'error' ? '#dc3545' : type === 'success' ? '#20c997' : '#6c757d';
  }

  function mapCrearOrdenRequest(preOrder) {
    const debug = preOrder?.Debug || {};
    const dir   = preOrder?.['Dirección de envío'] || null;
    const mp    = preOrder?.['Métodos de pago'] || null;
    const total = preOrder?.['Resumen del pedido']?.['Total del pedido'] ?? 0;

    return {
      IdCliente: Number(debug.clienteId ?? localStorage.getItem('clienteId') ?? 0),
      IdDireccionEnvio: dir?.id ?? null,
      Estado: 'Pagada',
      TrackingNumber: '',
      FechaCreacion: new Date().toISOString(),
      Items: (preOrder?.Productos || []).map(x => ({
        idProducto: x.idProducto ?? null,
        cantidad: Number(x.cantidad ?? 0),
        precioUnitario: Number(x.precioUnitario ?? 0)
      })),
      NumeroFactura: 'FAC-EEV-00001', // el servidor generará la siguiente si ya existe
      FechaEmision: new Date().toISOString(),
      Total: Number(total ?? 0),
      // Si viene null/0, el servidor buscará el método principal del cliente
      IdClienteMetodoPago: (mp?.id ?? null)
    };
  }

  function mapStockPayload(preOrder) {
    return (preOrder?.Productos || []).map(x => ({
      IdProducto: x.idProducto,
      Cantidad: Number(x.cantidad ?? 0)
    }));
  }

  function resolveCarritoId(preOrder) {
    const dbg = preOrder?.Debug || {};
    return Number(dbg.dbCartId ?? dbg.guestCartId ?? 0) || 0;
  }

  function clearLocalCart() {
    try {
      // Borrar carrito guest y flags que tu app usa
      localStorage.removeItem('guestCart');
      localStorage.removeItem('cart_from_bd');
      localStorage.removeItem('cart_hydrated');
      localStorage.removeItem('cart_origin');
      // Notificar a la UI (por si alguien escucha)
      document.dispatchEvent(new CustomEvent('cart:cleared'));
    } catch (e) {
      console.warn('clearLocalCart warn:', e);
    }
  }

async function run(preOrder) {
  console.log('🔥 [post_put] run() INICIADO con preOrder:', preOrder);  // Log temporal

  // 1) POST Orden
  setFeedback('Creando orden…');
  const ordReq = mapCrearOrdenRequest(preOrder);
  console.log('📤 [post_put] Enviando POST orden:', ordReq);  // Log temporal
  const post = await fetchJsonOrText('/api/postput/orden', {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify(ordReq)
  });
  console.log('📥 [post_put] Respuesta POST orden:', post);  // Log temporal
  if (!post.ok) {
    console.error('POST orden error', post);
    setFeedback(typeof post.data === 'string' && post.data
      ? post.data
      : 'No se pudo crear la orden.', 'error');
    return;
  }

  // 2) PUT stock
  setFeedback('Actualizando stock…');
  const stockBody = mapStockPayload(preOrder);
  console.log('📤 [post_put] Enviando PUT stock:', stockBody);  // Log temporal
  const putStock = await fetch('/api/postput/productos/stock', {
    method: 'PUT',
    headers: getAuthHeaders(true),
    body: JSON.stringify(stockBody)
  });
  console.log('📥 [post_put] Respuesta PUT stock:', { ok: putStock.ok, status: putStock.status });  // Log temporal
  if (!putStock.ok) {
    console.error('PUT stock error', putStock.status);
    setFeedback('No se pudo actualizar el stock.', 'error');
    return;
  }

  // 3) PUT cerrar carrito
  const carritoId = resolveCarritoId(preOrder);
  console.log('🛒 [post_put] Cerrando carrito ID:', carritoId);  // Log temporal
  if (carritoId) {
    setFeedback('Cerrando carrito…');
    const putCar = await fetch(`/api/postput/carrito/cerrar/${encodeURIComponent(carritoId)}`, {
      method: 'PUT',
      headers: getAuthHeaders(false)
    });
    console.log('📥 [post_put] Respuesta PUT carrito:', { ok: putCar.ok, status: putCar.status });  // Log temporal
    if (!putCar.ok) {
      console.warn('PUT cerrar carrito: no-ok', putCar.status);
      // seguimos igual; está cerrada la orden
    }
  }

  // 4) ÉXITO: Limpia y redirige
  console.log('✅ [post_put] TODO OK, limpiando y redirigiendo en 5s...');  // Log temporal
  clearLocalCart();
  setFeedback('✅ Orden creada con éxito.', 'success');
  setTimeout(() => {
    console.log('🚀 [post_put] EJECUTANDO REDIRECT a ../orders.html');  // Log temporal
    window.location.href = '../orders.html';  // ← CAMBIO: Path correcto para tu estructura
  }, 1000);  // Mantén el retraso para ver el mensaje
}
  window.postPut = { run };
})();
