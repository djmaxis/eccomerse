// wwwroot/js/orders/get_data_orders.js
(function () {
  // ===================== Helpers de formato =====================
  function pad8(n) {
    return String(n ?? '').padStart(8, '0');
  }

  function fmtOrderId(idOrden, fechaIso) {
    // fechaIso viene como "2025-09-11T02:16:33.042" -> usamos la parte de fecha YYYY-MM-DD
    try {
      const d = new Date(fechaIso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `ORD-${y}-${m}-${day}#${pad8(idOrden)}`;
    } catch {
      // fallback si fecha inválida
      return `ORD-????-??-??#${pad8(idOrden)}`;
    }
  }

  function fmtFechaCortaEs(fechaIso) {
    try {
      const d = new Date(fechaIso);
      // "8 sept 2025" o "8 sep 2025" según locale; normalizamos a minúsculas y sin punto final
      let s = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
      s = s.toLowerCase().replace(/\.$/, ''); // quitar punto final si lo hay
      return s;
    } catch {
      return fechaIso || '';
    }
  }

  function money(n) {
    if (typeof n !== 'number') {
      const parsed = Number(n);
      n = Number.isFinite(parsed) ? parsed : 0;
    }
    return `$${n.toFixed(2)}`;
  }

  // ===================== Helpers de datos / red =====================
  function getClienteId() {
    const cid = localStorage.getItem('clienteId');
    const n = parseInt(cid || '', 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function getAuthHeaders(withJson = true) {
    const h = {};
    const token = localStorage.getItem('token') || '';
    const cid = localStorage.getItem('clienteId') || '';
    if (withJson) h['Content-Type'] = 'application/json';
    if (cid) h['X-Cliente-Id'] = cid;
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async function fetchAnyJson(url, init) {
    const res = await fetch(url, init);
    const ct = res.headers.get('content-type') || '';
    let data = null, text = null;
    try {
      if (ct.includes('application/json')) data = await res.json();
      else text = await res.text();
    } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, data, text };
  }

  // Tolerancia camelCase/PascalCase
  const get = (obj, ...keys) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined) return obj[k];
    }
    return undefined;
  };

function normalizePayload(raw) {
  const out = { clienteId: get(raw || {}, 'clienteId', 'ClienteId') ?? null, ordenes: [] };
  const list = Array.isArray(get(raw || {}, 'ordenes', 'Ordenes')) ? get(raw, 'ordenes', 'Ordenes') : [];

  out.ordenes = list.map(o => {
    const idOrden = get(o, 'IdOrden', 'idOrden');
    const fechaCreacion = get(o, 'FechaCreacion', 'fechaCreacion');
    const idOrderMask = fmtOrderId(idOrden, fechaCreacion); // ← máscara

    const itemsSrc = get(o, 'Items', 'items');
    const items = Array.isArray(itemsSrc) ? itemsSrc.map(it => ({
      IdOrden: get(it, 'IdOrden', 'idOrden'),
      IdProducto: get(it, 'IdProducto', 'idProducto'),
      Nombre: get(it, 'Nombre', 'nombre') || 'Producto',
      Cantidad: get(it, 'Cantidad', 'cantidad') ?? 0,
      PrecioUnitario: get(it, 'PrecioUnitario', 'precioUnitario') ?? 0
    })) : [];

    const pagoSrc = get(o, 'Pago', 'pago');
    const pago = pagoSrc ? {
      IdOrden: idOrden,
      Monto: get(pagoSrc, 'Monto', 'monto') ?? 0,
      Estado: get(pagoSrc, 'Estado', 'estado') ?? 'pendiente'
    } : null;

    const facturaSrc = get(o, 'Factura', 'factura');
    const factura = facturaSrc ? {
      IdOrden: idOrden,
      NumeroFactura: get(facturaSrc, 'NumeroFactura', 'numeroFactura') ?? null
    } : null;

    const direccionSrc = get(o, 'Direccion', 'direccion');
    const direccion = direccionSrc ? {
      IdDireccion: get(direccionSrc, 'IdDireccion', 'idDireccion'),
      Alias: get(direccionSrc, 'Alias', 'alias'),
      Calle: get(direccionSrc, 'Calle', 'calle'),
      Ciudad: get(direccionSrc, 'Ciudad', 'ciudad'),
      Provincia: get(direccionSrc, 'Provincia', 'provincia'),
      Pais: get(direccionSrc, 'Pais', 'pais'),
      CodigoPostal: get(direccionSrc, 'CodigoPostal', 'codigoPostal'),
      Referencia: get(direccionSrc, 'Referencia', 'referencia'),
      Telefono: get(direccionSrc, 'Telefono', 'telefono')
    } : null;

    const mpSrc = get(o, 'MetodoPago', 'metodoPago');
    const metodoPago = mpSrc ? {
      IdClienteMetodoPago: get(mpSrc, 'IdClienteMetodoPago', 'idClienteMetodoPago'),
      IdCliente: get(mpSrc, 'IdCliente', 'idCliente'),
      Nombre: get(mpSrc, 'Nombre', 'nombre'),
      Tipo: get(mpSrc, 'Tipo', 'tipo'),
      // SIN cvv
      NumeroTarjeta: (() => {
        const nt = get(mpSrc, 'NumeroTarjeta', 'numeroTarjeta');
        if (!nt) return null;
        const str = String(nt).replace(/\s+/g,'');
        const last4 = str.slice(-4);
        return '•••• •••• •••• ' + last4;
      })(),
      Email: get(mpSrc, 'Email', 'email')
    } : null;

    return {
      IdOrden: idOrden,
      IdOrderMask: idOrderMask,   // ← máscara disponible en JSON
      IdCliente: get(o, 'IdCliente', 'idCliente'),
      Estado: get(o, 'Estado', 'estado'),
      TrackingNumber: get(o, 'TrackingNumber', 'trackingNumber') || '',
      FechaCreacion: fechaCreacion,
      Productos: items,
      Pago: pago,
      Factura: factura,
      Direccion: direccion,
      MetodoPago: metodoPago
    };
  });

  // índice para resolver por id numérico o por máscara (en minúsculas)
  out.index = { byAnyId: {} };
  for (const ord of out.ordenes) {
    const k1 = String(ord.IdOrden);
    const k2 = String(ord.IdOrderMask || fmtOrderId(ord.IdOrden, ord.FechaCreacion)).toLowerCase();
    out.index.byAnyId[k1] = ord.IdOrden;
    out.index.byAnyId[k2] = ord.IdOrden;
  }

  return out; // ← ¡esto faltaba!
}


  // Trae imagen del producto (desde tu API); tolera camelCase/PascalCase y errores
  const productoCache = new Map();
  async function fetchProductoById(id) {
    if (!id) return null;
    if (productoCache.has(id)) return productoCache.get(id);

    const headers = getAuthHeaders(false);
    // Intento 1: /api/productos/{id}
    let r = await fetchAnyJson(`/api/productos/${encodeURIComponent(id)}`, { headers, cache: 'no-store' });
    if (!r.ok || !r.data) {
      // Intento 2: /api/productos?id=ID
      r = await fetchAnyJson(`/api/productos?id=${encodeURIComponent(id)}`, { headers, cache: 'no-store' });
    }
    if (!r.ok || !r.data) {
      productoCache.set(id, null);
      return null;
    }

    // Si viene array/objeto
    const data = Array.isArray(r.data) ? (r.data.find(p => get(p, 'IdProducto', 'idProducto') === id) || r.data[0]) : r.data;
    const prod = {
      IdProducto: get(data, 'IdProducto', 'idProducto'),
      Nombre: get(data, 'Nombre', 'nombre'),
      Image: get(data, 'Image', 'image') || '/img/placeholder.jpg'
    };
    productoCache.set(id, prod);
    return prod;
  }

  async function enrichProductosWithImages(productos) {
    const ids = [...new Set(productos.map(p => p.IdProducto).filter(Boolean))];
    const results = await Promise.all(ids.map(id => fetchProductoById(id).catch(() => null)));
    const map = new Map();
    results.forEach(p => {
      if (p && p.IdProducto) map.set(p.IdProducto, p);
    });
    return productos.map(p => {
      const meta = map.get(p.IdProducto);
      return {
        ...p,
        Image: meta?.Image || '/img/placeholder.jpg'
      };
    });
  }

  // ==== Limpia nulls de forma profunda (objetos y arrays) ====
  function pruneNullsDeep(value) {
    if (value === null) return undefined;              // ← descartar null
    if (Array.isArray(value)) {
      const arr = value
        .map(pruneNullsDeep)
        .filter(v => v !== undefined);                 // ← quita elementos null
      return arr;
    }
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const nv = pruneNullsDeep(v);
        if (nv !== undefined) out[k] = nv;             // ← no copiar nulls
      }
      return out;
    }
    return value; // números 0, strings vacíos, false, etc. se conservan
  }


  // ===================== MODAL - Pedido =====================
(function(){
  let modalRoot = null;

function ensureModalRoot() {
  // Reutiliza si ya fue creado en esta sesión
  if (modalRoot) return modalRoot;

  // Reutiliza si ya existe en el DOM (evita duplicados si el script se carga 2 veces)
  const existing = document.getElementById('order-details-modal');
  if (existing) { 
    modalRoot = existing; 
    return modalRoot; 
  }

  // Crear raíz del modal
  modalRoot = document.createElement('div');
  modalRoot.id = 'order-details-modal';
  Object.assign(modalRoot.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000'
  });

  // Capa oscura
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    background: 'rgba(0,0,0,.45)'
  });
  overlay.addEventListener('click', closeModal);

  // Panel del modal
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'relative',
    maxWidth: '780px',
    width: '92%',
    maxHeight: '85vh',
    overflow: 'auto',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0,0,0,.2)',
    padding: '20px 22px'
  });

  // Botón cerrar
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '10px',
    right: '12px',
    fontSize: '20px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer'
  });
  closeBtn.addEventListener('click', closeModal);

  // Contenedor de contenido
  const content = document.createElement('div');
  content.className = 'order-modal-content';
  Object.assign(content.style, {
    display: 'grid',
    gap: '14px'
  });

  // Armar DOM
  panel.appendChild(closeBtn);
  panel.appendChild(content);
  modalRoot.appendChild(overlay);
  modalRoot.appendChild(panel);
  document.body.appendChild(modalRoot);

  return modalRoot;
}


  function pillGrey(text) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.background = '#f1f5f9';      // gris claro
    span.style.color = '#475569';
    span.style.borderRadius = '999px';
    span.style.padding = '4px 10px';
    span.style.fontSize = '12px';
    span.style.fontWeight = '600';
    return span;
  }

  function lineLabelValue(label, value, opts = {}) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    const l = document.createElement('span');
    l.textContent = label;
    l.style.color = opts.muted ? '#64748b' : '#0f172a';
    const v = document.createElement('strong');
    v.textContent = value;
    if (opts.blue) v.style.color = '#2563eb';
    row.appendChild(l); row.appendChild(v);
    return row;
  }

  function paymentBadge(metodoPago) {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';

    if (metodoPago?.Tipo === 'paypal') {
      const i = document.createElement('i');
      i.className = 'fa-brands fa-cc-paypal';
      i.style.fontSize = '22px';
      wrap.appendChild(i);
      const t = document.createElement('span');
      t.textContent = `PayPal — ${metodoPago?.Email || metodoPago?.Nombre || ''}`;
      wrap.appendChild(t);
    } else {
      // Tarjeta (Visa/Mastercard genérico)
      const i = document.createElement('i');
      i.className = 'fa-brands fa-cc-mastercard';
      i.style.fontSize = '22px';
      wrap.appendChild(i);
      const final = metodoPago?.NumeroTarjeta ? `Tarjeta — ${metodoPago.NumeroTarjeta}` : 'Tarjeta';
      const t = document.createElement('span');
      t.textContent = final;
      wrap.appendChild(t);
    }
    return wrap;
  }

  function productRow({ Image, Nombre, PrecioUnitario, Cantidad }) {
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '64px 1fr auto';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const img = document.createElement('img');
    img.src = Image || '/img/placeholder.jpg';
    img.alt = Nombre || 'Producto';
    img.style.width = '64px';
    img.style.height = '64px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '10px';
    img.style.border = '1px solid #e2e8f0';

    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.flexDirection = 'column';
    const name = document.createElement('strong');
    name.textContent = Nombre || 'Producto';
    const meta = document.createElement('span');
    meta.textContent = `${money(PrecioUnitario || 0)} · x${Cantidad || 0}`;
    meta.style.color = '#64748b';
    title.appendChild(name); title.appendChild(meta);

    const price = document.createElement('strong');
    const total = (Number(PrecioUnitario) || 0) * (Number(Cantidad) || 0);
    price.textContent = money(total);

    row.appendChild(img); row.appendChild(title); row.appendChild(price);
    return row;
  }

  function hr() {
    const d = document.createElement('div');
    d.style.height = '1px';
    d.style.background = '#e2e8f0';
    d.style.margin = '6px 0';
    return d;
  }

  function sectionTitle(text) {
    const h = document.createElement('h3');
    h.textContent = text;
    h.style.margin = '8px 0 2px';
    h.style.fontSize = '16px';
    h.style.fontWeight = '700';
    return h;
  }

  function closeModal() {
    if (!modalRoot) return;
    modalRoot.style.display = 'none';
  }

  // Abre el modal con toda la info
let __renderingOrderModal = false;

window.openOrderDetailsModal = async function(order, enrichFn) {
  if (__renderingOrderModal) return;         // <- evita doble apertura
  __renderingOrderModal = true;
  try {
    const root = ensureModalRoot();
    const content = root.querySelector('.order-modal-content');
    content.innerHTML = '';
    // Header: Fecha + ID
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.flexWrap = 'wrap';
    header.style.alignItems = 'center';
    header.style.gap = '10px';
    const fecha = document.createElement('div');
    fecha.innerHTML = `<strong>Fecha del pedido:</strong> ${fmtFechaCortaEs(order.FechaCreacion)}`;
    const pill = pillGrey(fmtOrderId(order.IdOrden, order.FechaCreacion));
    header.appendChild(fecha);
    header.appendChild(pill);
    content.appendChild(header);

    // Dirección de envío
    content.appendChild(sectionTitle('Dirección de envío'));
    const d = order.Direccion || {};
    const dirText = document.createElement('div');
    // Calle, Ciudad, País (si quieres añadir código postal, inclúyelo)
    dirText.textContent = [d.Calle, d.Ciudad, d.Pais].filter(Boolean).join(', ');
    content.appendChild(dirText);

    // Productos
    content.appendChild(sectionTitle('Productos'));
    const prods = Array.isArray(order.Productos) ? order.Productos.slice() : [];
    const enriched = typeof enrichFn === 'function' ? await enrichFn(prods) : prods;
    enriched.forEach(p => content.appendChild(productRow(p)));

    // Método de pago
    content.appendChild(sectionTitle('Método de pago'));
    content.appendChild(paymentBadge(order.MetodoPago));

    // Detalles del pago
    content.appendChild(sectionTitle('Detalles del pago'));
    const monto = Number(order?.Pago?.Monto) || 0;

    const totalLabel = document.createElement('div');
    totalLabel.style.fontSize = '18px';
    totalLabel.style.fontWeight = '800';
    totalLabel.textContent = 'Total del pedido:';
    content.appendChild(totalLabel);
    const totalMonto = document.createElement('div');
    totalMonto.style.fontSize = '18px';
    totalMonto.style.fontWeight = '800';
    totalMonto.textContent = money(monto);
    content.appendChild(totalMonto);

    // Factura
    const facFecha = document.createElement('div');
    facFecha.innerHTML = `<strong>Fecha de la factura del pedido:</strong> ${fmtFechaCortaEs(order.FechaCreacion)}`;
    const facId = pillGrey(`ID de la factura: ${order?.Factura?.NumeroFactura ?? '—'}`);
    const facWrap = document.createElement('div');
    facWrap.style.display = 'flex';
    facWrap.style.gap = '10px';
    facWrap.style.alignItems = 'center';
    facWrap.appendChild(facFecha);
    facWrap.appendChild(facId);
    content.appendChild(facWrap);

    content.appendChild(hr());
    content.appendChild(lineLabelValue('Total de artículos', '$0.00', { muted: true }));
    content.appendChild(lineLabelValue('Descuento de artículo(s):', '$0.00', { muted: true }));
    content.appendChild(lineLabelValue('Subtotal:', money(monto), { }));
    content.appendChild(hr());
    content.appendChild(lineLabelValue('Impuesto de ventas:', '$0.00', { muted: true }));
    content.appendChild(lineLabelValue('Crédito', '$0.00', { muted: true }));
    content.appendChild(hr());
    content.appendChild(lineLabelValue('Total del pedido', money(monto), { blue: true }));

    root.style.display = 'flex';
  } finally {
    // pequeño “debounce” para doble click muy rápido
    setTimeout(() => { __renderingOrderModal = false; }, 250);
  }
};
})();


  // ===================== Renderizado =====================
  function makeItemNode({ Nombre, Cantidad, Image }) {
    const a = document.createElement('a');
    a.className = 'item';
    a.setAttribute('role', 'listitem');
    a.href = '#';

    const img = document.createElement('img');
    img.src = Image || 'img/placeholder.jpg';
    img.alt = Nombre || 'Producto';

    const t = document.createElement('span');
    t.className = 'item-title';
    t.textContent = Nombre || 'Producto';

    const extra = document.createElement('span');
    extra.className = 'item-extra';
    extra.textContent = `Cantidad: ${Cantidad ?? 0}`;

    a.appendChild(img);
    a.appendChild(t);
    a.appendChild(extra);
    return a;
  }

function makeOrderCard({ IdOrden, FechaCreacion, Productos, Pago, Estado, TrackingNumber }) {
  const card = document.createElement('article');
  card.className = 'order-card order--compact';

  // Header
  const header = document.createElement('header');
  header.className = 'order-header';

  const orderIdDiv = document.createElement('div');
  orderIdDiv.className = 'order-id';
  orderIdDiv.textContent = fmtOrderId(IdOrden, FechaCreacion);

  const orderLink = document.createElement('a');
  orderLink.className = 'order-link';
  orderLink.href = '#';
  orderLink.innerHTML = 'Ver detalles del pedido <i class="fa-solid fa-chevron-right"></i>';

  header.appendChild(orderIdDiv);
  header.appendChild(orderLink);

  // Meta
  const meta = document.createElement('div');
  meta.className = 'order-meta';

  // Estado dinámico
  const badge = document.createElement('span');
  badge.className = `badge-dot status ${String(Estado || '').toLowerCase()}`;
  badge.textContent = Estado || '—';

  const sep = document.createElement('span');
  sep.className = 'meta-sep';
  sep.textContent = '|';

  const almacen = document.createElement('span');
  almacen.textContent = 'Centro de almacenes SDQ';

  // Tracking dinámico
  const tracking = document.createElement('span');
  tracking.style.marginLeft = '8px';
  tracking.textContent = TrackingNumber ? `Tracking: ${TrackingNumber}` : '';

  const metaDot = document.createElement('span');
  metaDot.className = 'meta-dot';

  meta.appendChild(badge);
  meta.appendChild(sep);
  meta.appendChild(almacen);
  if (TrackingNumber) meta.appendChild(tracking);
  meta.appendChild(metaDot);
    // Delivery row
    const deliveryRow = document.createElement('div');
    deliveryRow.className = 'delivery-row';
    const deliveryText = document.createElement('div');
    deliveryText.className = 'delivery-text';
    const deliveryTitle = document.createElement('strong');
    deliveryTitle.className = 'delivery-title';
    deliveryTitle.textContent = 'Entrega: 3-7 días hábiles';
    deliveryText.appendChild(deliveryTitle);
    const warranty = document.createElement('span');
    warranty.className = 'warranty-chip';
    warranty.textContent = '30 dias garantia / devoluciones';
    deliveryRow.appendChild(deliveryText);
    deliveryRow.appendChild(warranty);

    // Tira de items
    const orderArticle = document.createElement('div');
    orderArticle.className = 'order-article';
    const itemsStrip = document.createElement('div');
    itemsStrip.className = 'items-strip';
    itemsStrip.setAttribute('role', 'list');

    (Productos || []).forEach(p => {
      const node = makeItemNode(p);
      itemsStrip.appendChild(node);
    });

    // Acciones
    const actions = document.createElement('div');
    actions.className = 'order-actions-col';
    const btns = [
      ['Rastrear', 'Rastrear'],
      ['Ver factura', 'Ver_factura'],
      ['Cancelar pedido', 'Cancelar_pedido'],
      ['Comprar de nuevo', 'ghost'],
      ['Agregar instrucciones', 'ghost'],
      ['Contactar soporte', 'ghost'],
      ['Dejar reseña', 'ghost']
    ];
    btns.forEach(([label, css]) => {
      const b = document.createElement('button');
      b.className = `order-btn ${css}`;
      b.textContent = label;
      actions.appendChild(b);
    });

    orderArticle.appendChild(itemsStrip);
    orderArticle.appendChild(actions);

    // Footer resumen
    const footer = document.createElement('footer');
    footer.className = 'order-footer';

    const seller = document.createElement('div');
    seller.className = 'seller-line';
    seller.innerHTML = 'Vendido y enviado por <a href="#">EEV STORE</a>';

    const summary = document.createElement('div');
    summary.className = 'summary-line';

    const totalItems = (Productos || []).reduce((acc, it) => acc + (Number(it.Cantidad) || 0), 0); // #4 sumatoria
    const monto = Number(Pago?.Monto) || 0; // #5 total desde Pago.Monto

    const spanItems = document.createElement('span');
    spanItems.innerHTML = `${totalItems} artículos: <strong>${money(monto)}</strong>`;

    const spanFecha = document.createElement('span');
    spanFecha.innerHTML = `Fecha del pedido: <strong>${fmtFechaCortaEs(FechaCreacion)}</strong>`; // #6

    const spanId = document.createElement('span');
    spanId.innerHTML = `ID de pedido: <strong>${fmtOrderId(IdOrden, FechaCreacion)}</strong>`; // #1

    summary.appendChild(spanItems);
    summary.appendChild(spanFecha);
    summary.appendChild(spanId);

    footer.appendChild(seller);
    footer.appendChild(summary);

    // Armar card
    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(deliveryRow);
    card.appendChild(orderArticle);
    card.appendChild(footer);

    return card;
  }

async function renderOrders(json) {
  const section = document.querySelector('.perfil-section') || document.body;
  section.innerHTML = '';

  // (1) Enriquecer imágenes de los productos de cada orden para la tira de cards
  const list = Array.isArray(json?.ordenes) ? json.ordenes : [];
  for (const o of list) {
    o.Productos = await enrichProductosWithImages(o.Productos || []);
    const card = makeOrderCard(o);
    section.appendChild(card);

    // (2) Click -> Modal con todos los datos
    const link = card.querySelector('.order-link');
    if (link) {
      link.addEventListener('click', async (ev) => {
        ev.preventDefault();
        // Asegurarnos que en el modal también haya imágenes
        const enriched = await enrichProductosWithImages(o.Productos || []);
        const orderForModal = { ...o, Productos: enriched };
        window.openOrderDetailsModal(orderForModal, enrichProductosWithImages);
      });
    }
  }
}

  // ===================== Carga de datos & arranque =====================
  async function loadOrders(clienteId) {
    const init = { headers: getAuthHeaders(false), cache: 'no-store' };

    // Endpoint principal (GetDataOrderController)
    const primary = [
      `/api/orders/ordenes/cliente/${encodeURIComponent(clienteId)}`,
      `/api/orders/cliente/${encodeURIComponent(clienteId)}/ordenes`,
      `/api/orders/ordenes?clienteId=${encodeURIComponent(clienteId)}`
    ];

    for (const url of primary) {
      const r = await fetchAnyJson(url, init);
      if (r.ok) return r;
    }
    // Fallback: si por alguna razón no hay API, intenta el JSON ya guardado
    const localJson = await fetchAnyJson('/js/orders/get_data_orders.json', { cache: 'no-store' });
    return localJson;
  }

  async function saveJsonToServer(payload) {
    // Mantengo este paso por si quieres seguir guardando el espejo JSON
    const res = await fetch('/api/orders/json', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload)
    }).catch(() => null);
    if (res && res.ok) return res.json().catch(() => ({}));
    return null;
  }

  async function init() {
    const cid = getClienteId();
    if (!cid) {
      console.warn('[orders] clienteId ausente; no se cargarán pedidos.');
      return;
    }

    const r = await loadOrders(cid);
    if (!r.ok || !r.data) {
      console.error('[orders] No se pudieron cargar órdenes.', r?.status, r?.text);
      return;
    }

const raw = normalizePayload(r.data);
const json = pruneNullsDeep(raw); // ← limpia nulls

// guarda el espejo JSON SIEMPRE (ya sin nulls)
await saveJsonToServer(json).catch(() => {});

// si no estamos en modo silencioso, renderizamos tarjetas
if (!window.ORDERS_SILENT) {
  await renderOrders(json);
}

// emite evento para quien lo necesite (chatbot, etc.) ya limpio
document.dispatchEvent(new CustomEvent('orders:loaded', { detail: json }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
