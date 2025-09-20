// wwwroot/js/orders/cancelar.js
(function () {
  // ========= Utils =========
  const q = (sel, el = document) => el.querySelector(sel);

  function parseMaskToKey(mask) {
    return String(mask || '').trim().toLowerCase();
  }

  // Intenta resolver el IdOrden de varias formas:
  // 1) índice global (si lo puebla get_data_orders.js)
  // 2) data-idorden en la card (si lo agregaste al render)
  // 3) parte numérica final en la máscara ORD-YYYY-MM-DD#NNNN
  function resolveIdOrdenFromCard(card) {
    const idMask = q('.order-id', card)?.textContent?.trim() || '';
    const key = parseMaskToKey(idMask);

    if (window.ORDERS_INDEX?.byAnyId?.[key]) return window.ORDERS_INDEX.byAnyId[key];

    const dsVal = card?.dataset?.idorden;
    if (dsVal && /^\d+$/.test(dsVal)) return parseInt(dsVal, 10);

    const m = /#(\d{1,})$/.exec(idMask);
    if (m) return parseInt(m[1], 10);

    return null;
  }

  function getEstadoFromCard(card) {
    const txt = q('.order-meta .badge-dot.status', card)?.textContent || '';
    return txt.trim().toLowerCase();
  }

  // Llamadas API
  async function putCancelarOrden(idOrden) {
    const headers = {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
    };
    const res = await fetch(`/api/orders/orden/${encodeURIComponent(idOrden)}/cancelar`, { method: 'PUT', headers });
    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, payload };
  }

  async function getOrden(idOrden) {
    const headers = {
      ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
    };
    const res = await fetch(`/api/orders/orden/${encodeURIComponent(idOrden)}`, { headers });
    if (!res.ok) throw new Error(`GET orden ${idOrden} → ${res.status}`);
    return res.json();
  }

  // UI helpers
  function toast(msg) { alert(msg); }

  function paintBadgeEstado(badgeEl, estado) {
    // Normaliza
    const est = String(estado || '').trim().toLowerCase();
    const mapClass = {
      'pagada': 'pagada',
      'enviada': 'enviada',
      'completada': 'completada',
      'cancelada': 'cancelada'
    };
    const cls = mapClass[est] || '';
    badgeEl.className = `badge-dot status ${cls}`.trim();
    badgeEl.textContent = est ? est[0].toUpperCase() + est.slice(1) : estado;
  }

  // Refresca SOLO lo necesario en la card con la respuesta del backend
  function refreshOrderCardFromApi(card, apiOrder) {
    // Esperamos al menos: { IdOrden, NumeroOrden?, Estado, FechaCreacion?, ... }
    // Badge estado
    const badge = q('.order-meta .badge-dot.status', card);
    if (badge && apiOrder.Estado) paintBadgeEstado(badge, apiOrder.Estado);

    // Fecha (si tu endpoint devuelve FechaCreacion/FechaOrden)
    if (apiOrder.FechaCreacion) {
      // Busca línea "Fecha del pedido:"
      const fechaSpan = [...card.querySelectorAll('.summary-line span')]
        .find(s => s.textContent.toLowerCase().includes('fecha del pedido'));
      if (fechaSpan) {
        const strong = fechaSpan.querySelector('strong') || document.createElement('strong');
        strong.textContent = new Date(apiOrder.FechaCreacion).toLocaleDateString('es-DO', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        if (!fechaSpan.contains(strong)) fechaSpan.appendChild(strong);
      }
    }

    // Id/máscara: si el backend la retorna y quieres sincronizar
    if (apiOrder.NumeroOrden) {
      const idEl = q('.order-id', card);
      if (idEl) idEl.textContent = apiOrder.NumeroOrden;
    }
  }

  // Greyout
  function applyGreyOut(card, mensaje = 'Orden Cancelada', opacity = 0.6) {
    card.classList.add('order--cancelled');
    card.style.setProperty('--cancel-opacity', String(opacity));
    let overlay = card.querySelector('.order-cancelled-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'order-cancelled-overlay';
      overlay.textContent = mensaje;
      card.appendChild(overlay);
    }
  }

  // Handler principal: cancelar y refrescar con GET
// Handler principal: cancelar y refrescar con GET (valida → confirma → PUT → GET → greyout → desactiva → reload)
async function onCancelClick(ev) {
  const btn = ev.target.closest('.order-btn.Cancelar_pedido');
  if (!btn) return;

  const card = btn.closest('.order-card');
  if (!card) return;

  // ===== Validaciones rápidas en cliente =====
  const estado = getEstadoFromCard(card);
  if (estado === 'enviada') return toast('No puedes cancelar una orden enviada');
  if (estado === 'completada') return toast('No puede cancelar una orden completada');
  if (estado === 'cancelada') return toast('No puede enviar una orden cancelada');
  if (estado !== 'pagada') return toast('Solo puedes cancelar órdenes en estado "Pagada".');

  const idOrden = resolveIdOrdenFromCard(card);
  if (!idOrden) return toast('No pude identificar el Id de la orden.');

  // ===== Confirmación sólo si pasó las validaciones =====
  if (!confirm('¿Estás seguro de cancelar esta orden?')) return;

  // util local para desactivar botones de la card
  const disableOrderButtons = (cardEl) => {
    cardEl.querySelectorAll('.order-actions-col .order-btn').forEach(b => {
      b.disabled = true;
      b.classList.add('is-disabled');
      b.setAttribute('aria-disabled', 'true');
      b.style.pointerEvents = 'none';
      b.style.opacity = '0.6';
      b.style.filter = 'grayscale(0.3)';
      b.style.cursor = 'not-allowed';
    });
  };

  try {
    // 1) PUT cancelar
    const r = await putCancelarOrden(idOrden);
    if (!r.ok) {
      const msg = (r.payload && r.payload.message) || (typeof r.payload === 'string' ? r.payload : 'No se pudo cancelar.');
      return toast(msg);
    }

    // 2) GET /api/orders/orden/{idOrden} → refresca card con datos del backend
    const apiOrder = await getOrden(idOrden);
    refreshOrderCardFromApi(card, apiOrder);

    // 3) Greyout + desactivar botones inmediatamente
    applyGreyOut(card, 'Orden Cancelada', 0.6);
    disableOrderButtons(card);

    toast('Orden cancelada correctamente, se emitira un reembolso de 6 a 10 dias.');

    // 4) Refrescar la página para que todas las órdenes "Cancelada" también queden greyed-out
    //    (get_data_orders.js aplicará el greyout y la inactivación al cargar)
  } catch (err) {
    console.error(err);
  }
}


  document.addEventListener('click', onCancelClick);
})();
