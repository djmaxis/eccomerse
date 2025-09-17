// wwwroot/js/orders/get_data_orders_cpanel_shipping.js
(function () {
  // ========= Logging & utils =========
  const LOG = (...a) => console.log('%c[shipping:details]', 'color:#10b981;font-weight:bold', ...a);
  const ERR = (...a) => console.error('%c[shipping:details]', 'color:#ef4444;font-weight:bold', ...a);
  const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

  // ORD-YYYY-MM-DD#000000NN
  function fmtOrderIdLocal(idOrden, fechaIso) {
    const pad8 = (n) => String(n ?? '').padStart(8, '0');
    try {
      const d = new Date(fechaIso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `ORD-${y}-${m}-${day}#${pad8(idOrden)}`;
    } catch {
      return `ORD-????-??-??#${pad8(idOrden)}`;
    }
  }

  async function fetchJson(url, init) {
    const r = await fetch(url, init).catch(() => null);
    if (!r) return { ok: false, status: 0, data: null };
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    return { ok: r.ok, status: r.status, data };
  }

  // ========= Normalización robusta =========
  function normalizeOrder(raw, idHint, maskHint) {
    const o = raw || {};

    // Id y fecha
    let IdOrden = o.IdOrden ?? o.idOrden ?? null;
    if (!Number(IdOrden)) IdOrden = Number(idHint) || null;

    const FechaCreacion = o.FechaCreacion ?? o.fechaCreacion ?? o.Fecha ?? o.fecha ?? new Date().toISOString();

    // Items/Productos (tolerante a nombres)
    const itemsSrc =
      o.Items ?? o.items ??
      o.Productos ?? o.productos ??
      o.OrdenItems ?? o.ordenItems ??
      o.Detalles ?? o.detalles ?? [];

    const Productos = (Array.isArray(itemsSrc) ? itemsSrc : []).map(p => ({
      IdOrdenItem:    p.IdOrdenItem ?? p.idOrdenItem ?? null,
      IdOrden:        p.IdOrden ?? p.idOrden ?? IdOrden,
      IdProducto:     p.IdProducto ?? p.idProducto ?? p.Producto?.IdProducto ?? p.Producto?.idProducto,
      Nombre:         p.Nombre ?? p.nombre ?? p.Producto?.Nombre ?? p.Producto?.nombre ?? 'Producto',
      Cantidad:       Number(p.Cantidad ?? p.cantidad ?? p.Qty ?? p.qty ?? 0),
      PrecioUnitario: Number(p.PrecioUnitario ?? p.precioUnitario ?? p.Precio ?? p.precio ?? 0),
      Image:          p.Image || p.image || p.Producto?.Image || p.Producto?.image || '/img/placeholder.jpg'
    }));

    // Pago (acepta Pago.Monto o TotalOrden a nivel raíz)
    let Pago = o.Pago ?? o.pago ?? null;
    if (!Pago) {
      const totalRaiz = Number(o.TotalOrden ?? o.totalOrden ?? 0);
      Pago = { IdOrden: IdOrden, Monto: totalRaiz, Estado: o.Estado ?? o.estado ?? 'Pagada' };
    } else {
      Pago = {
        IdOrden: IdOrden,
        Monto: Number(Pago.Monto ?? Pago.monto ?? o.TotalOrden ?? o.totalOrden ?? 0),
        Estado: Pago.Estado ?? Pago.estado ?? (o.Estado ?? o.estado ?? 'Pagada')
      };
    }

    // Si Monto es 0, intenta calcular por items
    if (!Number(Pago.Monto) && Productos.length) {
      Pago.Monto = Productos.reduce((acc, p) => acc + (Number(p.PrecioUnitario) || 0) * (Number(p.Cantidad) || 0), 0);
    }

    // Dirección
    const d = o.Direccion ?? o.direccion ?? {};
    const Direccion = {
      IdDireccion: d.IdDireccion ?? d.idDireccion ?? null,
      Alias: d.Alias ?? d.alias,
      Calle: d.Calle ?? d.calle,
      Ciudad: d.Ciudad ?? d.ciudad,
      Provincia: d.Provincia ?? d.provincia,
      Pais: d.Pais ?? d.pais,
      CodigoPostal: d.CodigoPostal ?? d.codigoPostal,
      Referencia: d.Referencia ?? d.referencia,
      Telefono: d.Telefono ?? d.telefono
    };

    // Factura
    const f = o.Factura ?? o.factura ?? {};
    const Factura = {
      IdOrden: IdOrden,
      NumeroFactura: f.NumeroFactura ?? f.numeroFactura ?? null
    };

    // Método de pago (el modal lo muestra si está presente)
    const mpSrc = o.MetodoPago ?? o.metodoPago ?? o.Pago?.Metodo ?? o.pago?.metodo ?? null;
    const MetodoPago = mpSrc ? {
      IdClienteMetodoPago: mpSrc.IdClienteMetodoPago ?? mpSrc.idClienteMetodoPago,
      IdCliente: mpSrc.IdCliente ?? mpSrc.idCliente,
      Nombre: mpSrc.Nombre ?? mpSrc.nombre ?? '',
      Tipo: mpSrc.Tipo ?? mpSrc.tipo ?? 'tarjeta',
      NumeroTarjeta: (() => {
        const nt = mpSrc.NumeroTarjeta ?? mpSrc.numeroTarjeta;
        if (!nt) return null;
        const str = String(nt).replace(/\s+/g,'');
        const last4 = str.slice(-4);
        return '•••• •••• •••• ' + last4;
      })(),
      Email: mpSrc.Email ?? mpSrc.email ?? null
    } : null;

    // Máscara (usa pista si llega desde el botón)
    const IdOrderMask =
      o.IdOrderMask ?? o.idOrderMask ??
      maskHint ??
      (o.NumeroOrden ?? o.numeroOrden) ??
      fmtOrderIdLocal(IdOrden, FechaCreacion);

    return {
      IdOrden,
      IdOrderMask,
      FechaCreacion,
      Estado: o.Estado ?? o.estado ?? 'Pagada',
      TrackingNumber: o.TrackingNumber ?? o.trackingNumber ?? '',
      Productos,
      Pago,
      Direccion,
      Factura,
      MetodoPago
    };
  }

  // ========= Enriquecer imágenes (si faltan) =========
  async function enrichProductosWithImages(productos) {
    const ids = [...new Set((productos || []).map(p => p.IdProducto).filter(Boolean))];
    const results = await Promise.all(ids.map(async (id) => {
      const r = await fetchJson(`/api/productos/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!r.ok || !r.data) return null;
      const d = Array.isArray(r.data) ? r.data[0] : r.data;
      return { id, image: d?.Image || d?.image || '/img/placeholder.jpg' };
    }).map(p => p.catch(() => null)));

    const map = new Map();
    results.forEach(x => { if (x && x.id) map.set(x.id, x.image); });

    return (productos || []).map(p => ({
      ...p,
      Image: map.get(p.IdProducto) || p.Image || '/img/placeholder.jpg'
    }));
  }

  // ========= Cargar detalles por API / espejo =========
  async function loadOrderFromAPI(idOrden) {
    // Tu endpoint actual de shipping pinta tablas, pero el detalle viene del módulo de órdenes:
    // GET /api/orders/orden/{id} -> payload con .ordenes[]
    // (si en tu backend cambia, ajusta aquí)
    const r = await fetchJson(`/api/orders/orden/${encodeURIComponent(idOrden)}`, { cache: 'no-store' });
    if (!r.ok || !r.data) return null;
    const payload = r.data;
    const ordRaw = Array.isArray(payload?.ordenes) ? payload.ordenes[0] : null;
    if (!ordRaw) return null;

    // Guardamos un espejo JSON (opcional, no bloquea)
    fetch('/api/orders/json-shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});

    return { source: '/api/orders/orden', order: ordRaw };
  }

  async function loadOrderFromMirror(idOrden, maskHint) {
    const r = await fetchJson('/js/orders/get_data_orders_cpanel_shipping.json', { cache: 'no-store' });
    if (!r.ok || !r.data) return null;
    const arr = Array.isArray(r.data?.ordenes) ? r.data.ordenes : [];
    let ordRaw = arr.find(o => String(o?.IdOrden ?? o?.idOrden) === String(idOrden)) || null;
    if (!ordRaw && maskHint) {
      ordRaw = arr.find(o => String(o?.IdOrderMask ?? o?.idOrderMask ?? '').toLowerCase() === String(maskHint).toLowerCase()) || null;
    }
    return ordRaw ? { source: 'mirror', order: ordRaw } : null;
  }

  // ========= Fallback modal (si no existe openOrderDetailsModal) =========
  function fallbackModal(order) {
    let root = document.getElementById('shipping-fallback-modal');
    if (!root) {
      root = document.createElement('div');
      root.id = 'shipping-fallback-modal';
      Object.assign(root.style, { position:'fixed', inset:'0', display:'none', alignItems:'center', justifyContent:'center', zIndex:'10000' });

      const ov = document.createElement('div');
      Object.assign(ov.style, { position:'absolute', inset:'0', background:'rgba(0,0,0,.45)' });
      ov.addEventListener('click', () => root.style.display='none');

      const panel = document.createElement('div');
      Object.assign(panel.style, { position:'relative', width:'92%', maxWidth:'760px', maxHeight:'85vh', overflow:'auto', background:'#fff', borderRadius:'16px', boxShadow:'0 20px 40px rgba(0,0,0,.2)', padding:'18px' });

      const close = document.createElement('button');
      close.textContent = '×';
      Object.assign(close.style, { position:'absolute', top:'6px', right:'10px', fontSize:'22px', border:'none', background:'transparent', cursor:'pointer' });
      close.addEventListener('click', () => root.style.display='none');

      const content = document.createElement('div');
      content.className = 'content';

      panel.appendChild(close);
      panel.appendChild(content);
      root.appendChild(ov);
      root.appendChild(panel);
      document.body.appendChild(root);
    }

    const c = root.querySelector('.content');
    c.innerHTML = '';

    const h = document.createElement('h3');
    h.textContent = `Orden ${order?.IdOrderMask || '#' + order?.IdOrden}`;
    c.appendChild(h);

    const dir = order?.Direccion || {};
    const d = document.createElement('div');
    d.textContent = [dir.Calle, dir.Ciudad, dir.Pais].filter(Boolean).join(', ');
    c.appendChild(d);

    const ul = document.createElement('ul'); ul.style.paddingLeft = '18px';
    (order?.Productos || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.Nombre} x${p.Cantidad} — ${money(p.PrecioUnitario)}`;
      ul.appendChild(li);
    });
    c.appendChild(ul);

    const monto = Number(order?.Pago?.Monto) || 0;
    const tot = document.createElement('strong');
    tot.textContent = `Total: ${money(monto)}`;
    c.appendChild(tot);

    root.style.display = 'flex';
  }

  // ========= API pública: abrir por Id (usa pista opcional de máscara) =========
  async function openByOrderId(idOrden, maskHint) {
    try {
      LOG('openByOrderId:start', { idOrden, maskHint });

      let found = await loadOrderFromAPI(idOrden);
      if (!found) found = await loadOrderFromMirror(idOrden, maskHint);

      if (!found) {
        ERR('openByOrderId: no se encontró la orden');
        alert('No se pudo cargar la orden.');
        return;
      }

      // Normaliza con hints (para evitar #00000000 y completar campos)
      let ord = normalizeOrder(found.order, idOrden, maskHint);

      // Enriquecer imágenes
      const enriched = await enrichProductosWithImages(ord.Productos || []);
      ord = { ...ord, Productos: enriched };

      // Modal “pro” del cliente (get_data_orders.js) o fallback
      if (typeof window.openOrderDetailsModal === 'function') {
        await window.openOrderDetailsModal(ord, enrichProductosWithImages);
      } else {
        fallbackModal(ord);
      }
    } catch (e) {
      ERR('openByOrderId:error', e);
      alert('Error al abrir detalles de la orden.');
    }
  }

  // Exponer API global
  window.ShippingDetails = { openByOrderId };

  // Señal de disponibilidad
  document.addEventListener('DOMContentLoaded', () => {
    const openFn = typeof window.ShippingDetails?.openByOrderId;
    LOG('DOMContentLoaded', { hasShippingDetails: !!window.ShippingDetails, openFn });
  });
})();
