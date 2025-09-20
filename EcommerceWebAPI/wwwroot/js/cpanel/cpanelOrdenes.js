// wwwroot/js/cpanel/cpanelOrdenes.js
(function () {
  // ========= Helpers =========
  var qs  = function (s, el) { return (el || document).querySelector(s); };
  var LOG = function () { try { console.log.apply(console, ['%c[ordenes]', 'color:#2563eb;font-weight:bold'].concat([].slice.call(arguments))); } catch(_){} };
  var WARN= function () { try { console.warn.apply(console, ['%c[ordenes]', 'color:#d97706;font-weight:bold'].concat([].slice.call(arguments))); } catch(_){} };
  var ERR = function () { try { console.error.apply(console, ['%c[ordenes]', 'color:#ef4444;font-weight:bold'].concat([].slice.call(arguments))); } catch(_){} };

// === Fuente de datos para la tabla de Órdenes en cpanel ===
var USE_MIRROR = (window.CPANEL_ORDENES_SOURCE === 'mirror');

// Carga desde espejo general /js/orders/get_data_orders.json
function loadFromMirror() {
  LOG('loadFromMirror:/js/orders/get_data_orders.json');
  return fetch('/js/orders/get_data_orders.json', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(j){
      // j puede ser array o {ordenes:[...]}
      var list = Array.isArray(j) ? j : (Array.isArray(j && j.ordenes) ? j.ordenes : []);
      LOG('loadFromMirror:list', list.length);
      return list;
    })
    .catch(function(err){
      ERR('loadFromMirror:error', err);
      return [];
    });
}


  // Mantener sesión (etiqueta arriba a la derecha si existe)
  function setUserLabel() {
    try {
      var n = qs('#userLabel');
      if (!n) return;
      var nombre = localStorage.getItem('nombre') || localStorage.getItem('correo') || 'Usuario';
      n.textContent = nombre;
    } catch (_) {}
  }

  window.addEventListener('error', function(e){ ERR('window.error', e.error || e.message, e.filename, e.lineno); });
  window.addEventListener('unhandledrejection', function(e){ ERR('unhandledrejection', e.reason); });

  // === Formato dinero 10,000.00 ===
  var nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return nf.format(Number(n) || 0); }

  function badgeStyle(statusRaw) {
    var s = (statusRaw || '').toString().trim().toLowerCase();
    if (s.indexOf('cancel') === 0) return 'background:#FF5C5C;color:#fff';
    if (s.indexOf('complet') === 0) return 'background:#CFCFCF;color:#111';
    if (s.indexOf('envi') === 0)    return 'background:#FFDD8A;color:#111';
    if (s.indexOf('paga') === 0)    return 'background:#B8F2B1;color:#111';
    return 'background:#CFCFCF;color:#111';
  }

  // Utilidad para leer propiedades con múltiples aliases
  function pick(o, keys, def) {
    if (def === void 0) def = '';
    for (var i = 0; i < keys.length; i++) {
      var path = keys[i].split('.');
      var acc = o;
      for (var j = 0; j < path.length; j++) {
        if (acc && Object.prototype.hasOwnProperty.call(acc, path[j])) {
          acc = acc[path[j]];
        } else { acc = undefined; break; }
      }
      if (acc !== undefined && acc !== null) return acc;
    }
    return def;
  }

// ---- Normalización para la tabla (robusta) ----
function normalizeRow(o) {
  o = o || {};
  var IdOrden  = Number(pick(o, ['IdOrden','idOrden','OrdenCompra.IdOrden'])) || null;
  var NoOrden  = pick(o, ['IdOrderMask','idOrderMask','NoOrden','noOrden','NumeroOrden','numeroOrden'], null);
  var Fecha    = pick(o, ['Fecha','fecha','FechaCreacion','fechaCreacion'], '');
  var Cliente  = pick(o, ['Cliente','cliente','ClienteNombre','clienteNombre','Cliente.Nombre','cliente.nombre'], '');
  var Estatus  = pick(o, ['Estatus','estatus','Estado','estado'], '');
  var Tracking = pick(o, ['TrackingNumber','trackingNumber','Tracking','tracking'], '');

  var costoTotalOrden = Number(pick(o, ['CostoTotal','costoTotal','OrdenCompra.CostoTotal','ordenCompra.costoTotal'], 0)) || 0;
  var pagoMonto       = Number(pick(o, ['TotalOrden','totalOrden','Pago.Monto','pago.monto'], 0)) || 0;

  var itemsSrc = pick(o, ['Items','items','Productos','productos','OrdenItems','ordenItems','Detalles','detalles'], []);
  var costoItems = 0;
  if (Array.isArray(itemsSrc)) {
    for (var k = 0; k < itemsSrc.length; k++) {
      var p = itemsSrc[k];
      var c = Number(pick(p, ['CostoUnitario','costoUnitario','Costo','costo'], 0));
      var q = Number(pick(p, ['Cantidad','cantidad'], 0));
      costoItems += c * q;
    }
  }

  var Costo    = (costoTotalOrden || costoItems);
  var Monto    = pagoMonto;
  var Ganancia = Monto - Costo;

  return { 
    IdOrden: IdOrden, 
    NoOrden: NoOrden, 
    Fecha: Fecha, 
    Cliente: Cliente, 
    Estatus: Estatus, 
    Tracking: Tracking, 
    Monto: Monto, 
    Costo: Costo, 
    Ganancia: Ganancia, 
    __raw:o 
  };
}


  function fetchJson(url) {
    LOG('fetchJson:', url);
    return fetch(url, { cache: 'no-store' })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        LOG('fetchJson:resp', url, r.status, r.ok, ct);
        if (ct.indexOf('application/json') !== -1) {
          return r.json().then(function (data) { return { ok:r.ok, status:r.status, data:data }; });
        }
        return { ok:r.ok, status:r.status, data:null };
      })
      .catch(function (err) { ERR('fetchJson:error', url, err); return { ok:false, status:0, data:null }; });
  }

// Carga fuente para la TABLA; si falla usa espejo
function loadSource(filters) {
  if (USE_MIRROR) {
    return loadFromMirror();
  }

  var qp = new URLSearchParams();
  if (filters && filters.fechaini) qp.set('fechaini', filters.fechaini);
  if (filters && filters.fechafin) qp.set('fechafin', filters.fechafin);
  if (filters && filters.estatus)  qp.set('estatus',  filters.estatus);
  if (filters && filters.cliente)  qp.set('cliente',  filters.cliente);
  if (filters && filters.no)       qp.set('no',       filters.no);
  qp.set('take','300');

  var apiUrl = '/api/orders?' + qp.toString();
  LOG('loadSource:api', apiUrl, 'filters=', filters);

  return fetchJson(apiUrl).then(function (r) {
    if (r.ok && r.data) {
      if (Array.isArray(r.data && r.data.ordenes)) { LOG('loadSource:api->ordenes[]'); return r.data.ordenes; }
      if (Array.isArray(r.data)) { LOG('loadSource:api->array'); return r.data; }
    }
    LOG('loadSource:api FAIL -> fallback /js/orders/get_data_orders.json');
    return loadFromMirror();
  });
}

  // ====== DETALLES (abrir modal) SIN depender de ShippingDetails ======
  async function fetchOrderDetails(idOrden, mask) {
  // 1) API detallada (solo la aceptamos si trae items/productos)
  try {
    const r = await fetch('/api/orders/orden/' + encodeURIComponent(idOrden), { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const apiOrd = Array.isArray(j && j.ordenes) ? j.ordenes[0] : null;
      const itemsApi = apiOrd && (apiOrd.Productos || apiOrd.Items || apiOrd.Detalles || apiOrd.OrdenItems);
      if (apiOrd && Array.isArray(itemsApi) && itemsApi.length > 0) {
        return apiOrd;
      }
    }
  } catch(_) {}

  // 2) Espejo general (si API no tenía detalles)
  try {
    const r2 = await fetch('/js/orders/get_data_orders.json', { cache: 'no-store' });
    if (r2.ok) {
      const j2 = await r2.json().catch(() => null);
      const list = (j2 && (j2.ordenes || j2)) || [];
      const mirrorOrd = list.find(o =>
        String(o && o.IdOrden) === String(idOrden) ||
        String((o && (o.IdOrderMask || o.NoOrden || o.NumeroOrden)) || '').toLowerCase() === String(mask || '').toLowerCase()
      );
      if (mirrorOrd) return mirrorOrd;
    }
  } catch(_) {}

  return null;

  }

  async function ensureModalScripts() {
    // En cpanelordenes.html YA se incluye cpanel_get_data_orders.js antes de este archivo,
    // pero por seguridad comprobamos su disponibilidad.
    if (typeof window.openOrderDetailsModal === 'function') return true;
    var s = document.createElement('script');
    s.src = '/js/cpanel/cpanel_get_data_orders.js';
    s.defer = true;
    const p = new Promise((res, rej) => {
      s.onload = () => res(true);
      s.onerror = () => rej(new Error('No se pudo cargar cpanel_get_data_orders.js'));
    });
    document.head.appendChild(s);
    return p.catch(err => { ERR('ensureModalScripts', err); return false; });
  }

  // Guard anti doble click
  var __openLock = false;

  async function openOrderModalDirect(idOrden, mask) {
    try {
      if (__openLock) { WARN('detalles:IGNORADO (ya abriendo)'); return; }
      __openLock = true;

      const ok = await ensureModalScripts();
      if (!ok) throw new Error('No se pudo preparar el modal');

// Dentro de openOrderModalDirect(idOrden, mask) — reemplaza la parte final:
const ord = await fetchOrderDetails(idOrden, mask);
if (!ord) throw new Error('Orden no encontrada');

// 🔁 Enriquecemos SIEMPRE antes de pintar:
if (typeof window.enrichProductosWithImages === 'function') {
  const items = ord.Productos || ord.Items || ord.Detalles || ord.OrdenItems || [];
  const enriched = await window.enrichProductosWithImages(items);
  ord.Productos = enriched;
}

// Pintar modal con imágenes correctas:
await window.openOrderDetailsModal(ord, window.enrichProductosWithImages || (async x => x));
window.dispatchEvent(new CustomEvent('order-modal:opened'));




    } catch (e) {
      ERR('openOrderModalDirect', e);
      alert('No se pudo abrir el detalle de la orden. Revisa consola.');
      window.dispatchEvent(new CustomEvent('order-modal:closed'));
    } finally {
      setTimeout(function(){ __openLock = false; }, 300);
    }
  }

  // ========= Filtro en cliente (tabla) =========
// cpanelOrdenes.js
function matchesFilters(r, filters) {
  // r: fila normalizada: { IdOrden, NoOrden, Fecha, Cliente, Estatus, ... }
  // filters: { fechaini, fechafin, estatus: string[] | string, cliente, no }

  filters = filters || {};

  // === Normalizadores auxiliares ===
  const toDateStr = (v) => (v == null ? '' : String(v)).slice(0, 10); // "YYYY-MM-DD"
  const normTxt   = (s) => (s == null ? '' : String(s)).toLowerCase().trim();

  // === 1) Fechas (INCLUSIVAS) ===
  // r.Fecha proviene del normalizador (o FechaCreacion si aplica) 
  const fechaRow = toDateStr(r.Fecha || r.FechaCreacion || '');
  if (filters.fechaini) {
    if (fechaRow && fechaRow < filters.fechaini) return false;
  }
  if (filters.fechafin) {
    if (fechaRow && fechaRow > filters.fechafin) return false;
  }

  // === 2) Estatus (array o string) ===
  // Con checkboxes el filtro llega como array; si el array está vacío NO filtra por estatus.
  const rowStatus = (r.Estatus == null ? '' : String(r.Estatus)); // p.ej. "Pagada" | "Enviada" | ...
  let allowedStatuses = null;

  if (Array.isArray(filters.estatus)) {
    allowedStatuses = filters.estatus.filter(Boolean).map(String);
  } else if (typeof filters.estatus === 'string' && filters.estatus.trim() !== '') {
    allowedStatuses = [filters.estatus.trim()];
  }

  if (allowedStatuses && allowedStatuses.length > 0) {
    // Coincidencia exacta con los valores normalizados que manejas: "Pagada", "Enviada", "Completada", "Cancelada"
    if (!allowedStatuses.includes(rowStatus)) return false;
  }

  // === 3) Cliente (contiene, case-insensitive) ===
  if (filters.cliente) {
    const needle = normTxt(filters.cliente);
    const hay    = normTxt(r.Cliente);
    if (!hay.includes(needle)) return false;
  }

  // === 4) No. de orden (máscara o id; acepta fragmentos) ===
  if (filters.no) {
    const q     = normTxt(filters.no);
    const mask  = normTxt(r.NoOrden || r.IdOrderMask || ''); // tu normalizador expone NoOrden / IdOrderMask 
    const idStr = normTxt(r.IdOrden != null ? String(r.IdOrden) : '');
    if (!mask.includes(q) && !idStr.includes(q)) return false;
  }

  return true;
}


  function loadOrdenes(filters) {
    LOG('loadOrdenes:start', filters);
    return loadSource(filters).then(function (src) {
      var rows = (Array.isArray(src) ? src : []).map(normalizeRow);
      LOG('loadOrdenes:rows(normalized)=', rows.length, rows.slice(0,3));
      return rows.filter(function (r) { return matchesFilters(r, filters); });
    });
  }

  function paintTable(rows) {
    LOG('paintTable:rows=', rows.length);
    var tb = qs('#tblOrdenes tbody'); if (!tb) { WARN('paintTable:tbody not found'); return; }
    var html = rows.map(function(r){
      return (
        '<tr>' +
          '<td>' + (r.NoOrden || '-') + '</td>' +
          '<td>' + (r.Cliente || '-') + '</td>' +
          '<td>' + (r.Fecha || '-') + '</td>' +
          '<td><span class="badge" style="' + badgeStyle(r.Estatus) + '">' + (r.Estatus || '-') + '</span></td>' +
          '<td>' + (r.Tracking || '-') + '</td>' +
          '<td>$' + money(r.Ganancia) + '</td>' +
          '<td>$' + money(r.Costo)    + '</td>' +
          '<td>$' + money(r.Monto)    + '</td>' +
          '<td>' +
            '<div class="row-actions">' +
              '<button class="btn btn-lightblue" ' +
                'data-action="ver" ' +
                'data-ordenid="' + (r.IdOrden || '') + '" ' +
                'data-no="' + (r.NoOrden || '') + '" ' +
                'data-mask="' + (r.NoOrden || '') + '">' +
                'Ver orden completa' +
              '</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
    tb.innerHTML = html;
  }

  // ========= Loader resiliente para ShippingDetails (rutas /js/cpanel primero) =========
  function scriptExists(url) {
    return !![].slice.call(document.scripts).find(function(s){ return (s.src||'').indexOf(url) !== -1; });
  }
  function loadScriptOnce(url) {
    return new Promise(function(resolve, reject){
      LOG('loadScriptOnce:try', url);
      if (scriptExists(url)) { LOG('loadScriptOnce:already-present', url); resolve(true); return; }
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.dataset.loader = 'ordenes';
      s.onload  = function(){ LOG('loadScriptOnce:onload', url); resolve(true); };
      s.onerror = function(){ ERR('loadScriptOnce:onerror', url); reject(new Error('404 '+url)); };
      document.head.appendChild(s);
    });
  }
  function delay(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }

  async function tryLoadShippingDetails() {
    // Preferimos /js/cpanel/, pero aceptamos también el nombre anterior por compatibilidad
    var candidates = [
      '/js/cpanel/cpanelshipping.js',
      '/js/cpanel/get_data_orders_cpanel_shipping.js',
      '/js/orders/get_data_orders_cpanel_shipping.js'
    ];
    for (var i=0;i<candidates.length;i++){
      try {
        await loadScriptOnce(candidates[i]);
        var tries = 0;
        while (tries++ < 30) {
          if (window.ShippingDetails && typeof window.ShippingDetails.openByOrderId === 'function') {
            LOG('tryLoadShippingDetails:OK with', candidates[i]);
            return true;
          }
          await delay(100);
        }
        WARN('tryLoadShippingDetails:timeout waiting window.ShippingDetails after', candidates[i]);
      } catch(e) {
        ERR('tryLoadShippingDetails:error', candidates[i], e);
      }
    }
    return false;
  }

  // “Guard” anti doble click (se libera con eventos del modal)
  var __opening = false;
  window.addEventListener('order-modal:opened', function(){ __opening = false; });
  window.addEventListener('order-modal:closed', function(){ __opening = false; });

  async function ensureShippingDetails() {
    LOG('ensureShippingDetails:start');

    // 1) ¿ya está listo?
    if (window.ShippingDetails && typeof window.ShippingDetails.openByOrderId === 'function') {
      if (typeof window.openOrderDetailsModal !== 'function') {
        try {
          // versión de cpanel
          await loadScriptOnce('/js/cpanel/cpanel_get_data_orders.js');
          LOG('ensureShippingDetails: cpanel_get_data_orders.js loaded to provide openOrderDetailsModal');
        } catch (e) {
          WARN('ensureShippingDetails: could not load cpanel_get_data_orders.js; will rely on shipping fallback UI', e);
        }
      }
      return true;
    }

    // 2) Intentar cargar shipping
    var loaded = await tryLoadShippingDetails();

    if (!loaded) {
      // 3) Plan C -> shim con cpanel_get_data_orders.js
      WARN('ensureShippingDetails: plan C -> shim via cpanel_get_data_orders.js');
      try {
        await loadScriptOnce('/js/cpanel/cpanel_get_data_orders.js'); // define openOrderDetailsModal
        window.ShippingDetails = window.ShippingDetails || {};
        window.ShippingDetails.openByOrderId = async (idOrden, mask) => {
          LOG('[shim] openByOrderId', { idOrden, mask });
          try {
            let ord = null;

            // intenta API detallada
            let r = await fetch('/api/orders/orden/' + encodeURIComponent(idOrden), { cache: 'no-store' });
            try {
              const j = await r.json();
              ord = Array.isArray(j?.ordenes) ? j.ordenes[0] : null;
            } catch {}

            if (!ord) {
              // espejo general
              const r2 = await fetch('/js/cpanel/get_data_orders.json', { cache: 'no-store' });
              const j2 = await r2.json().catch(() => null);
              const list = (j2 && (j2.ordenes || j2)) || [];
              ord = list.find(o =>
                String(o?.IdOrden) === String(idOrden) ||
                String(o?.IdOrderMask || '').toLowerCase() === String(mask || '').toLowerCase()
              ) || null;
            }

            if (!ord) throw new Error('Orden no encontrada para mostrar');

            if (typeof window.enrichProductosWithImages === 'function') {
              const items = ord.Productos || ord.Items || ord.Detalles || [];
              const enriched = await window.enrichProductosWithImages(items);
              ord = { ...ord, Productos: enriched };
            }

            window.openOrderDetailsModal(ord, window.enrichProductosWithImages || (async x => x));
          } catch (e) {
            ERR('[shim] openByOrderId:error', e);
            alert('No se pudo abrir el detalle de la orden (shim). Revisa consola.');
          } finally {
            window.dispatchEvent(new CustomEvent('order-modal:opened'));
          }
        };
        LOG('ensureShippingDetails: shim listo con cpanel_get_data_orders.js');
        return true;
      } catch (e) {
        ERR('ensureShippingDetails: plan C failed', e);
        return false;
      }
    }

    // 4) ShippingDetails está listo. Garantiza el modal “bonito”
    if (typeof window.openOrderDetailsModal !== 'function') {
      try {
        await loadScriptOnce('/js/cpanel/cpanel_get_data_orders.js');
        LOG('ensureShippingDetails: loaded cpanel_get_data_orders.js');
      } catch (e) {
        WARN('ensureShippingDetails: could not load cpanel_get_data_orders.js; shipping will use fallback UI', e);
      }
    }
    return true;
  }

  async function handleVerOrden(btn) {
    var idOrden = Number(btn && btn.dataset && btn.dataset.ordenid) || null;
    var mask    = (btn && btn.dataset && (btn.dataset.mask || btn.dataset.no)) || '';
    LOG('detalles:abrir', { idOrden: idOrden, mask: mask });

    try {
      if (__opening) { LOG('detalles:IGNORADO (ya abriendo)'); return; }
      __opening = true;

      var ok = await ensureShippingDetails(mask);
      if (!ok) throw new Error('No se pudo cargar get_data_orders_cpanel_shipping.js ni aplicar el shim');

      if (window.ShippingDetails && typeof window.ShippingDetails.openByOrderId === 'function') {
        LOG('detalles:invoke ShippingDetails.openByOrderId', { idOrden, mask });
        await window.ShippingDetails.openByOrderId(idOrden, mask);
      } else {
        throw new Error('ShippingDetails.openByOrderId no está disponible tras ensureShippingDetails()');
      }
    } catch (e) {
      ERR('detalles:error', e);
      alert('No se pudo abrir el detalle de la orden. Revisa consola para diagnóstico.');
    } finally {
      // por si algo falla, no quedarnos “enganchados”
      __opening = false;
    }
  }

  // ========= Delegación de click =========
  document.addEventListener('click', function(ev){
    var btn = ev.target.closest('button[data-action="ver"]');
    if (btn) {
      ev.preventDefault();
      handleVerOrden(btn);
    }
  });

  // ========= API pública para filtros =========
 function updateStats(rows) {
   try {
     const elVentas = document.getElementById('statSumVentas');
     const elGan    = document.getElementById('statSumGanancias');
     const elCnt    = document.getElementById('statCount');

     const sumMonto = rows.reduce((acc, r) => acc + (Number(r.Monto) || 0), 0);
     const sumCosto = rows.reduce((acc, r) => acc + (Number(r.Costo) || 0), 0);
    const sumGan   = rows.reduce((acc, r) => acc + (Number(r.Ganancia) || 0), 0);

     if (elVentas) elVentas.textContent = `$${money(sumMonto)}`;
    if (elGan)    elGan.textContent    = `$${money(sumGan)}`;    // ✅ ahora muestra SUMA DE GANANCIAS
     if (elCnt)    elCnt.textContent    = (rows.length || 0).toString();

    LOG('updateStats', { sumMonto, sumCosto, sumGan, count: rows.length });
   } catch (e) {
     ERR('updateStats:error', e);
   }
 }


  async function applyOrdenesFilters(filters) {
    try {
      LOG('applyOrdenesFilters', filters);
      const rows = await loadOrdenes(filters);
      LOG('applyOrdenesFilters:rows.filtered=', rows.length);
      paintTable(rows);
      updateStats(rows);
        if (typeof window.updateSumatoriaGanancias === 'function') {
      window.updateSumatoriaGanancias(filters);
    }
    } catch (e) {
      ERR('applyOrdenesFilters:error', e);
      alert('No se pudieron cargar las órdenes');
    }
  }

window.applyOrdenesFilters = function(filters) {
  loadSource(filters).then(rows => {
    // 1) Normaliza cada orden (asegúrate de que aquí ya contemplas CostoTotal)
    let norm = rows.map(normalizeRow);

    // 2) Filtra en cliente (si corresponde)
    if (typeof matchesFilters === 'function') {
      norm = norm.filter(r => matchesFilters(r, filters));
    }

    // 3) Pinta
    paintTable(norm);

    // 4) KPIs
    updateStats(norm);
  });
};


  // ========= Primer render =========
  document.addEventListener('DOMContentLoaded', function(){
    setUserLabel();
    LOG('DOMContentLoaded: cpanelOrdenes.js listo');
  });
})();
