// ===== cpanel_get_data_orders.js (con LOG + CSS inline estilo shipping, sin bloquear fondo) =====
(function(){
  // ------------ LOGGING ------------
  var DEBUG = (typeof window.ORDER_DETAILS_DEBUG === 'boolean') ? window.ORDER_DETAILS_DEBUG : true;
  function LOG(){ if(!DEBUG) return; try{ console.log.apply(console, ['%c[ordenes:modal]', 'color:#0ea5e9;font-weight:bold'].concat([].slice.call(arguments))); }catch(_){} }
  function WARN(){ if(!DEBUG) return; try{ console.warn.apply(console, ['%c[ordenes:modal]', 'color:#f59e0b;font-weight:bold'].concat([].slice.call(arguments))); }catch(_){} }
  function ERR(){ try{ console.error.apply(console, ['%c[ordenes:modal]', 'color:#ef4444;font-weight:bold'].concat([].slice.call(arguments))); }catch(_){} }

  LOG('init cpanel_get_data_orders.js at', new Date().toISOString());

  // ------------ CSS INLINE (estilo shipping) ------------
  function ensureStyles() {
    if (document.getElementById('order-details-styles')) return;
    const css = `
    /* ------- CONTENEDOR / MODAL -------- */
    #order-details-modal.ordenes-page {
      position: fixed; inset: 0;
      display: none; align-items: center; justify-content: center;
      z-index: 10000;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Noto Sans', 'Helvetica Neue', Arial, 'Apple Color Emoji','Segoe UI Emoji';
      color: #0f172a; /* slate-900 */
    }
    #order-details-modal .overlay{
      position:absolute; inset:0;
      background: transparent;             /* ← NO oscurece */
      pointer-events: none;                 /* ← NO bloquea clics ni scroll detrás */
    }
    #order-details-modal .dialog{
      position:relative;
      width: 95%; max-width: 840px;
      max-height: 85vh; overflow:auto;
      background:#fff; border-radius: 16px;
      box-shadow: 0 20px 40px rgba(15,23,42,.2);
      padding: 18px 20px 16px;
      border:1px solid #e2e8f0;            /* gray-200 */
    }

    /* ------- HEADER -------- */
    #order-details-modal header{
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding-bottom: 6px;
    }
    #order-details-modal header h3{
      margin:0; font-size:18px; font-weight:700;
    }
    #order-details-modal .btn, 
    #order-details-modal .close{
      border: none; background: transparent; cursor:pointer;
    }
    #order-details-modal .close{
      font-size: 20px; line-height: 1; color:#0f172a;
    }

    /* ------- CUERPO -------- */
    #order-details-modal .body{
      display:block;
      margin-top: 8px;
    }
    #order-details-modal .section-title{
      font-weight:700; margin: 10px 0 8px; color:#0f172a;
    }
    #order-details-modal .chip{
      display:inline-block; background:#edf2f7; color:#111;
      border-radius: 999px; padding: 6px 10px; font-size: 12px;
    }
    #order-details-modal .meta-grid{
      display:grid; grid-template-columns: 1fr auto; gap: 12px;
      padding: 6px 0 4px;
      border-bottom:1px solid #e2e8f0;
    }

    /* ------- LÍNEAS DE PRODUCTO -------- */
    #order-details-modal .product-row{
      display:grid; grid-template-columns: 1fr auto; align-items:center;
      padding:10px 0; border-bottom:1px solid #edf2f7;
    }
    #order-details-modal .product-row .left{
      display:flex; gap:12px; align-items:center;
    }
    #order-details-modal .product-row img{
      width:64px; height:64px; object-fit:cover;
      border-radius: 10px; border:1px solid #e2e8f0;
    }
    #order-details-modal .product-name{
      font-weight:700; margin-bottom:2px;
    }
    #order-details-modal .product-sub{
      color:#475569; font-size: 13px;
    }
    #order-details-modal .product-price{
      font-weight:700;
    }

    /* ------- BLOQUE DE TOTALES -------- */
    #order-details-modal .totals{
      margin-top:8px; border-top:1px solid #e2e8f0;
    }
    #order-details-modal .totals .row{
      display:grid; grid-template-columns:1fr auto;
      padding:10px 0; border-bottom:1px solid #edf2f7; color:#334155;
    }
    #order-details-modal .totals .row strong{
      font-weight:600;
    }
    #order-details-modal .totals .final{
      display:grid; grid-template-columns:1fr auto;
      padding:12px 0; color:#0f172a; font-weight:800;
    }

    /* ------- FOOTER -------- */
    #order-details-modal .footer{
      display:flex; justify-content:flex-end; gap:8px; margin-top:10px;
    }
    #order-details-modal .btn-outline{
      border:1px solid #cbd5e1; background:#fff; color:#0f172a;
      border-radius:8px; padding:6px 10px; cursor:pointer;
    }
    `;
    const style = document.createElement('style');
    style.id = 'order-details-styles';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
    LOG('ensureStyles: injected');
  }

  // ------------ Utils ------------
  const $ = (s, el=document) => el.querySelector(s);
  const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => `$${nf.format(Number(n)||0)}`;

  function pick(o, keys, def='') {
    for (const k of keys) {
      const v = k.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), o);
      if (v !== undefined && v !== null) return v;
    }
    return def;
  }

  function fechaCortaES(x) {
    try {
      const d = new Date(x); if (isNaN(+d)) return String(x||'-');
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
      return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return String(x||'-'); }
  }

  // === Enriquecer imágenes como en shipping ===
  async function enrichProductosWithImages(productos) {
    const arr = Array.isArray(productos) ? productos : [];
    const ids = [...new Set(arr.map(p => p.IdProducto).filter(Boolean))];
    LOG('enrichProductosWithImages:ids', ids);

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const url = `/api/productos/${encodeURIComponent(id)}`;
          LOG('fetch producto', id, url);
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) { WARN('producto fetch !ok', id, r.status); return null; }
          const data = await r.json().catch(() => null);
          const d = Array.isArray(data) ? data[0] : data;
          return { id, image: (d && (d.Image || d.image)) || '/img/placeholder.jpg' };
        } catch (e) {
          ERR('producto fetch error', id, e);
          return null;
        }
      })
    );

    const map = new Map();
    results.forEach(x => { if (x && x.id) map.set(x.id, x.image); });
    const out = arr.map(p => ({
      ...p,
      Image: p.Image || p.Imagen || map.get(p.IdProducto) || '/img/placeholder.jpg',
      Nombre: p.Nombre || p.name || p.Titulo || p.titulo || 'Producto',
      Cantidad: Number(p.Cantidad ?? p.cantidad ?? 1),
      PrecioUnitario: Number(p.PrecioUnitario ?? p.precioUnitario ?? p.Precio ?? p.precio ?? 0),
      CostoUnitario: Number(p.CostoUnitario ?? p.costoUnitario ?? p.Costo ?? p.costo ?? 0)
    }));
    LOG('enrichProductosWithImages:out sample', out.slice(0,3));
    return out;
  }

  // ------------ Modal DOM (reutiliza tu estructura) ------------
  function ensureModalRoot(){
    ensureStyles(); // <= inyecta CSS si falta

    let root = document.getElementById('order-details-modal');
    if (root) { LOG('ensureModalRoot: reuse existing node'); return root; }

    LOG('ensureModalRoot:create');
    root = document.createElement('div');
    root.id = 'order-details-modal';
    root.className = 'ordenes-page';
    root.innerHTML = `
      <div class="overlay" data-close="1"></div>
      <div class="dialog">
        <header>
          <h3>Detalles de la orden</h3>
          <button class="close" data-close="1" aria-label="Cerrar">×</button>
        </header>
        <div class="body"></div>
        <div class="footer">
          <button class="btn-outline" data-close> Cerrar </button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // El overlay NO cierra (es no-bloqueante), pero dejamos el botón y el de footer
    root.addEventListener('click', (ev)=>{
      const closer = ev.target.closest('[data-close]');
      if (closer) {
        LOG('modal:close click');
        root.style.display = 'none';
        window.dispatchEvent(new CustomEvent('order-modal:closed'));
      }
    });

    return root;
  }

  // ------------ Plantilla visual estilo shipping (solo HTML) ------------
  function renderShippingLike(order){
    const fecha   = pick(order, ['Fecha','FechaCreacion'], '');
    const fechaUI = fechaCortaES(fecha);
    const mask    = pick(order, ['IdOrderMask','NoOrden','NumeroOrden','mask'], '');
    const estado  = pick(order, ['Estatus','Estado'], '-');

    const dir = order.Direccion || order.direccion || {};
    const mp  = order.MetodoPago || order.metodoPago || order?.Pago?.Metodo || order?.pago?.metodo || null;

    const items = Array.isArray(order?.Productos) ? order.Productos
                : Array.isArray(order?.Items)     ? order.Items
                : Array.isArray(order?.Detalles)  ? order.Detalles
                : Array.isArray(order?.OrdenItems)? order.OrdenItems : [];

    let totalMonto = 0, totalCosto = 0, totalCant = 0;
    for (const p of items) {
      const q = Number(p.Cantidad)||0;
      totalCant += q;
      totalMonto += (Number(p.PrecioUnitario)||0) * q;
      totalCosto += (Number(p.CostoUnitario)||0)  * q;
    }
    const monto = Number(order.TotalOrden ?? order?.Pago?.Monto ?? totalMonto);
    const costo = Number(order.CostoTotal ?? order?.OrdenCompra?.CostoTotal ?? totalCosto);

    const prods = items.map(p => `
      <div class="product-row">
        <div class="left">
          <img src="${p.Image || p.Imagen || '/img/placeholder.jpg'}" alt="">
          <div>
            <div class="product-name">${p.Nombre || 'Producto'}</div>
            <div class="product-sub">${money(p.PrecioUnitario)} · x${p.Cantidad}</div>
          </div>
        </div>
        <div class="product-price">${money((Number(p.PrecioUnitario)||0)*(Number(p.Cantidad)||0))}</div>
      </div>
    `).join('');

    return `
      <!-- Encabezado tipo shipping -->
      <div class="meta-grid" style="border-bottom:none;padding-top:0">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#334155">
          <div><strong>Fecha del pedido:</strong> ${fechaUI}</div>
          ${mask ? `<span class="chip">${mask}</span>` : ''}
          ${estado ? `<span class="chip">${estado}</span>` : ''}
        </div>
        <div style="text-align:right"></div>
      </div>

      <!-- Dirección de envío -->
      <div class="section-title">Dirección de envío</div>
      <div style="color:#334155">
        ${[dir.Calle, dir.Ciudad, dir.Provincia, dir.Pais].filter(Boolean).join(', ') || '-'}
      </div>

      <!-- Productos -->
      <div class="section-title" style="margin-top:14px">Productos</div>
      ${prods || '<em style="color:#64748b">Sin productos</em>'}

      <!-- Método de pago -->
      <div class="section-title" style="margin-top:14px">Método de pago</div>
      <div style="color:#334155">
        ${mp?.Nombre || mp?.nombre || (mp ? 'Tarjeta' : (order?.Pago?.Estado || ''))}
        ${order?.Pago?.Email ? ` — ${order.Pago.Email}` : (mp?.Email ? ` — ${mp.Email}` : '')}
      </div>

      <!-- Detalles del pago -->
      <div class="section-title" style="margin-top:14px">Detalles del pago</div>
      <div style="font-weight:800;font-size:20px;margin:10px 0">Total del pedido:</div>
      <div style="font-weight:800;font-size:22px;margin-bottom:8px">${money(monto)}</div>

      <!-- Totales -->
      <div class="totals">
        <div class="row"><div>Total de artículos</div><div><strong>${totalCant}</strong></div></div>
        <div class="row"><div>Descuento de artículo(s)</div><div><strong>${money(0)}</strong></div></div>
        <div class="row"><div>Subtotal:</div><div><strong>${money(monto)}</strong></div></div>
        <div class="row"><div>Impuesto de ventas:</div><div><strong>${money(0)}</strong></div></div>
        <div class="row"><div>Crédito</div><div><strong>${money(0)}</strong></div></div>
        <div class="final"><div>Total del pedido</div><div>${money(monto)}</div></div>
      </div>
    `;
  }

  // ------------ API pública ------------
  async function openOrderDetailsModal(order, enrichFn){
    LOG('openOrderDetailsModal:start', { hasOrder: !!order, keys: Object.keys(order||{}) });

    try {
      const root = ensureModalRoot();
      const body = root.querySelector('.body');
      if (!body) { throw new Error('modal body not found'); }

      // Enriquecer SIEMPRE (por si viene del espejo JSON sin imágenes)
      const baseItems =
        Array.isArray(order?.Productos) ? order.Productos :
        Array.isArray(order?.Items)     ? order.Items :
        Array.isArray(order?.Detalles)  ? order.Detalles :
        Array.isArray(order?.OrdenItems)? order.OrdenItems : [];

      LOG('openOrderDetailsModal:baseItems', baseItems.length, baseItems.slice(0,2));
      const enricher  = enrichFn || enrichProductosWithImages;
      const productos = await enricher(baseItems);
      LOG('openOrderDetailsModal:enrichedItems', productos.length);

      const fullOrder = { ...order, Productos: productos };

      body.innerHTML = renderShippingLike(fullOrder);
      root.style.display = 'flex';
      window.dispatchEvent(new CustomEvent('order-modal:opened'));
      LOG('openOrderDetailsModal:done');
    } catch (e) {
      ERR('openOrderDetailsModal:error', e);
      alert('No se pudo abrir el detalle de la orden (modal). Revisa consola.');
      window.dispatchEvent(new CustomEvent('order-modal:closed'));
    }
  }

  // Exponer globals
  window.enrichProductosWithImages = enrichProductosWithImages;
  window.openOrderDetailsModal = openOrderDetailsModal;

  LOG('cpanel_get_data_orders.js ready');
})();
