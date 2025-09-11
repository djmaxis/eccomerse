// js/checkout/proc_pago.js
// Valida secciones, corre los modales y, al cerrar "Aprobado", construye y guarda pre_order.json.
// Luego ejecuta POST+PUT (post_put.js) y redirige a index.html.

(function () {
  const BTN_ID = 'confirmar-pagar-btn';

  /* ============== Utils ============== */
  async function fetchJson(url, init) {
    try {
      const res = await fetch(url, init);
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      console.warn('fetchJson error:', e);
      return { ok: false, status: 0, data: null };
    }
  }

  function getClienteId() {
    const cid = localStorage.getItem('clienteId');
    const n = parseInt(cid || '', 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function getAuthHeaders(withJson = true) {
    const token = localStorage.getItem('token') || '';
    const cid   = localStorage.getItem('clienteId') || '';
    const h = {};
    if (withJson) h['Content-Type'] = 'application/json';
    if (cid) h['X-Cliente-Id'] = cid;
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  function isLoggedIn() {
    return !!(localStorage.getItem('token') || localStorage.getItem('clienteId'));
  }

  // 👇 Nuevo parser de dinero que detecta el separador decimal correctamente
  function parseMoneySmart(el) {
    if (!el) return 0;
    let s = String(el.textContent || '').trim();
    if (!s) return 0;
    // quitar símbolos
    s = s.replace(/[^\d.,-]/g, '');
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
      // ambos presentes: el que aparece más a la derecha es el decimal
      const decSep = lastDot > lastComma ? '.' : ',';
      const thouSep = decSep === '.' ? ',' : '.';
      s = s.replace(new RegExp('\\' + thouSep, 'g'), '');
      if (decSep === ',') s = s.replace(',', '.');
    } else if (lastDot !== -1) {
      // solo punto -> tratarlo como decimal (NO lo quites)
      // nada que hacer
    } else if (lastComma !== -1) {
      // solo coma -> es decimal
      s = s.replace(',', '.');
    } else {
      // solo dígitos
    }
    const num = parseFloat(s);
    return Number.isFinite(num) ? num : 0;
  }

  function setFeedback(text, type = 'info') {
    const el = document.getElementById('checkout-feedback');
    if (!el) return;
    el.textContent = text || '';
    el.style.color =
      type === 'error' ? '#dc3545' : type === 'success' ? '#20c997' : '#6c757d';
  }

  function focusCard(selector) {
    const card = document.querySelector(selector);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.transition = 'box-shadow .2s ease';
    const prev = card.style.boxShadow;
    card.style.boxShadow = '0 0 0 3px rgba(220,53,69,.35)';
    setTimeout(() => { card.style.boxShadow = prev; }, 600);
  }

  /* ============== Recolectores ============== */

  // 1) Dirección de envío (principal o primera)
  async function collectDireccionEnvio() {
    const clienteId = getClienteId();
    if (!clienteId) return null;

    const r = await fetchJson(`/api/direcciones?clienteId=${encodeURIComponent(clienteId)}`, {
      headers: getAuthHeaders(false)
    });
    if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) return null;

    const arr = r.data;
    const principal = arr.find(d => d.EsPrincipal || d.esPrincipal) || arr[0];
    if (!principal) return null;

    const id = principal.IdDireccion ?? principal.idDireccion ?? principal.id;
    return {
      id,
      nombre: principal.Nombre ?? principal.nombre ?? '',
      telefono: principal.Telefono ?? principal.telefono ?? '',
      calle: principal.Calle ?? principal.calle ?? '',
      ciudad: principal.Ciudad ?? principal.ciudad ?? '',
      codigoPostal: principal.CodigoPostal ?? principal.codigoPostal ?? '',
      pais: principal.Pais ?? principal.pais ?? '',
      esPrincipal: !!(principal.EsPrincipal || principal.esPrincipal)
    };
  }

  // 2) Productos (desde BD si logueado; si no, desde guestCart)
  async function collectProductos() {
    if (isLoggedIn()) {
      const r = await fetchJson('/api/carrito/abierto', { headers: getAuthHeaders(false), cache: 'no-store' });
      const cart = r.ok ? (r.data || {}) : {};
      const items = cart.items || cart.Items || [];
      return items.map(x => ({
        idCarritoItem: x.IdCarritoItem ?? x.idCarritoItem ?? null,
        idProducto: x.IdProducto ?? x.productId ?? x.idProducto ?? x.productID ?? null,
        refModelo: x.RefModelo ?? x.refModelo ?? x.ref ?? null,
        nombre: x.Nombre ?? x.nombre ?? x.name ?? 'Producto',
        cantidad: Number(x.Cantidad ?? x.cantidad ?? x.qty ?? 1),
        precioUnitario: Number(x.PrecioUnitario ?? x.precioUnitario ?? x.price ?? 0),
        imagenUrl: x.ImagenUrl ?? x.imagenUrl ?? x.img ?? null
      }));
    } else {
      const raw = localStorage.getItem('guestCart');
      let data = null;
      try { data = JSON.parse(raw || 'null'); } catch { data = null; }
      const items = Array.isArray(data?.items) ? data.items : [];
      return items.map(x => ({
        idCarritoItem: null,
        idProducto: (Number.isFinite(parseInt(x.id,10)) ? parseInt(x.id,10) : null),
        refModelo: x.ref ?? null,
        nombre: x.name ?? 'Producto',
        cantidad: Number(x.qty ?? 1),
        precioUnitario: Number(x.price ?? 0),
        imagenUrl: x.img ?? null
      }));
    }
  }

  // 3) Método de pago (radio marcado + datos completos desde API)
  async function collectMetodoPagoSeleccionado() {
    const clienteId = getClienteId();
    if (!clienteId) return null;

    const checked = document.querySelector('form#paymethods-form input[name="paymethod"]:checked');
    const selectedId = checked ? String(checked.value) : null;

    const r = await fetchJson(`/api/clientes/${encodeURIComponent(clienteId)}/metodos-pago`, {
      headers: getAuthHeaders(false)
    });
    if (!r.ok || !Array.isArray(r.data)) return null;

    const list = r.data;
    const found = selectedId
      ? list.find(m => String(
          m.IdClienteMetodoPago ?? m.idClienteMetodoPago ?? m.id ?? m.Id
        ) === selectedId)
      : (list[0] || null);
    if (!found) return null;

    return {
      id: found.IdClienteMetodoPago ?? found.idClienteMetodoPago ?? found.id ?? found.Id ?? null,
      tipo: (found.Tipo ?? found.tipo ?? '').toLowerCase(),
      nombre: found.Nombre ?? found.nombre ?? found.Alias ?? found.alias ?? '',
      numeroEnmascarado: found.NumeroEnmascarado ?? found.numeroEnmascarado ?? found.NumeroTarjeta ?? found.numeroTarjeta ?? null,
      email: found.Email ?? found.email ?? null,
      esPrincipal: !!(found.EsPrincipal || found.esPrincipal)
    };
  }

  // 4) Total del pedido (desde el DOM)  ← ahora usando parseMoneySmart
  function collectTotalPedido() {
    const totalEl = document.getElementById('total') || document.getElementById('total-amount');
    const total = parseMoneySmart(totalEl);
    return { moneda: 'USD', total };
  }

  // 5) Debug (clienteId + guestCart items + info carrito BD)
  async function collectDebugSnapshot() {
    const clienteId = getClienteId();

    // guestCart items
    let guestCartItems = 0;
    try {
      const guest = JSON.parse(localStorage.getItem('guestCart') || 'null');
      guestCartItems = Array.isArray(guest?.items) ? guest.items.length : 0;
    } catch { guestCartItems = 0; }

    // BD cart
    let fromBD = false, dbCartId = null, dbItemsCount = 0;
    if (isLoggedIn()) {
      const r = await fetchJson('/api/carrito/abierto', { headers: getAuthHeaders(false), cache: 'no-store' });
      if (r.ok && r.data) {
        const cart = r.data;
        dbCartId = cart.id ?? cart.Id ?? null;
        const items = cart.items ?? cart.Items ?? [];
        dbItemsCount = Array.isArray(items) ? items.length : 0;
        fromBD = true;
      }
    }

    const summary = `clienteId ${clienteId ?? 'null'}  guestCart items: ${guestCartItems}`;
    return { clienteId, guestCartItems, fromBD, dbCartId, dbItemsCount, summary };
  }

  /* ============== Guardado del pre_order en servidor ============== */
  async function persistPreorderToServer(preOrder) {
    const headers = { 'Content-Type': 'application/json' };
    const cid = localStorage.getItem('clienteId') || '';
    const token = localStorage.getItem('token') || '';
    if (cid) headers['X-Cliente-Id'] = cid;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/json/preorder', {
      method: 'POST',
      headers,
      body: JSON.stringify(preOrder)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`No se pudo guardar pre_order.json en el servidor. HTTP ${res.status} ${txt}`);
    }
    const payload = await res.json().catch(() => ({}));
    console.log('[pre_order] guardado en servidor:', payload);
    return payload;
  }

  /* ============== Construcción pre_order ============== */
  async function buildAndSavePreOrder() {
    const [dir, productos, metodo, totalObj, debugInfo] = await Promise.all([
      collectDireccionEnvio(),
      collectProductos(),
      collectMetodoPagoSeleccionado(),
      Promise.resolve(collectTotalPedido()),
      collectDebugSnapshot()
    ]);

    const preOrder = {
      timestamp: new Date().toISOString(),
      "Dirección de envío": dir,
      "Productos": productos,
      "Métodos de pago": metodo,
      "Resumen del pedido": {
        "Total del pedido": totalObj.total,
        "Moneda": totalObj.moneda
      },
      "Debug": debugInfo
    };

    await persistPreorderToServer(preOrder);
    return preOrder; // se usa en post_put.js
  }

  /* ============== Validación previa al primer modal ============== */
  async function validateBeforeFlow() {
    setFeedback('');

    // 1) Dirección
    if (!isLoggedIn()) {
      setFeedback('Tienes que agregar o registrar una direccion', 'error');
      focusCard('.shipping-card');
      return false;
    } else {
      const clienteId = getClienteId();
      if (!clienteId) {
        setFeedback('Tienes que agregar o registrar una direccion', 'error');
        focusCard('.shipping-card');
        return false;
      }
      const rDir = await fetchJson(`/api/direcciones?clienteId=${encodeURIComponent(clienteId)}`, {
        headers: getAuthHeaders(false)
      });
      const dirs = (rDir.ok && Array.isArray(rDir.data)) ? rDir.data : [];
      if (dirs.length < 1) {
        setFeedback('Tienes que agregar o registrar una direccion', 'error');
        focusCard('.shipping-card');
        return false;
      }
    }

    // 2) Productos
    let itemsCount = 0;
    if (isLoggedIn()) {
      const rCart = await fetchJson('/api/carrito/abierto', { headers: getAuthHeaders(false), cache: 'no-store' });
      const cart = rCart.ok ? (rCart.data || {}) : {};
      const items = cart.items || cart.Items || [];
      itemsCount = Array.isArray(items) ? items.length : 0;
    } else {
      try {
        const guest = JSON.parse(localStorage.getItem('guestCart') || 'null');
        itemsCount = Array.isArray(guest?.items) ? guest.items.length : 0;
      } catch { itemsCount = 0; }
    }
    if (itemsCount < 1) {
      setFeedback('Tienes que agregar al carrito uno o mas producto', 'error');
      focusCard('.products-card');
      return false;
    }

    // 3) Métodos de pago
    const clienteId = getClienteId();
    const payList = isLoggedIn() && clienteId
      ? await (async () => {
          const r = await fetchJson(`/api/clientes/${encodeURIComponent(clienteId)}/metodos-pago`, {
            headers: getAuthHeaders(false)
          });
          return (r.ok && Array.isArray(r.data)) ? r.data : [];
        })()
      : [];

    const radios = Array.from(document.querySelectorAll('form#paymethods-form input[name="paymethod"]'));
    const countPay = Math.max(payList.length, radios.length);
    if (countPay < 1) {
      setFeedback('Tienes que agregar o registrar un metodo de pago', 'error');
      focusCard('.paymethods-card');
      return false;
    }
    const checked = radios.find(r => r.checked);
    if (!checked && radios[0]) {
      radios[0].checked = true;
    }

    setFeedback('✅ Todo listo. Procesando…', 'success');
    return true;
  }

  /* ============== Flujo visual de pago (modales) ============== */
  function playProcFlow() {
    const m1 = document.getElementById('proc-modal1');
    const m2 = document.getElementById('proc-modal2');
    if (!m1 || !m2) {
      console.warn('[proc_pago] No se encontraron #proc-modal1 / #proc-modal2 en checkout.html');
      return;
    }

    // Mostrar "Procesando"
    m1.classList.add('active');
    m1.setAttribute('aria-hidden', 'false');

    // Cambiar a "Aprobado"
    setTimeout(() => {
      m1.classList.remove('active');
      m1.setAttribute('aria-hidden', 'true');

      m2.classList.add('active');
      m2.setAttribute('aria-hidden', 'false');

      // Cerrar "Aprobado"
      setTimeout(() => {
        m2.classList.remove('active');
        m2.setAttribute('aria-hidden', 'true');
        // El observer detectará este cierre.
      }, 2000);
    }, 3000);
  }

  async function onClickConfirm(e) {
    e.preventDefault();
    try {
      const ok = await validateBeforeFlow();
      if (!ok) return;
      playProcFlow();
    } catch (err) {
      console.error(err);
      setFeedback('Ocurrió un error al confirmar el pedido.', 'error');
    }
  }

  function wireButton() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.removeEventListener('click', onClickConfirm);
    btn.addEventListener('click', onClickConfirm);
  }

  // Exponer por si lo quieres llamar desde otros scripts
  window.procPago = window.procPago || {};
  window.procPago.start = async function () {
    const ok = await validateBeforeFlow();
    if (ok) playProcFlow();
  };

  /* ============== Observer: cierre de proc-modal2 ============== */
  function observeProcModal2Close() {
    const modal = document.getElementById('proc-modal2');
    if (!modal) return;

    let lastHidden = modal.getAttribute('aria-hidden') !== 'false';
    const obs = new MutationObserver((muts) => {
      muts.forEach(m => {
        if (m.attributeName === 'aria-hidden') {
          const nowHidden = modal.getAttribute('aria-hidden') !== 'false';
          if (lastHidden === false && nowHidden === true) {
            // Visible -> Oculto: se cerró "Aprobado"
            (async () => {
              try {
                const preOrder = await buildAndSavePreOrder();
                if (window.postPut?.run) {
                  await window.postPut.run(preOrder); // POST + PUTs + limpiar + redirigir
                } else {
                  // Fallback
                  window.location.href = 'orders.html';
                }
              } catch (err) {
                console.error('[proc_pago] post/put error', err);
                setFeedback('No se pudo finalizar la orden.', 'error');
              }
            })();
          }
          lastHidden = nowHidden;
        }
      });
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
  }

  /* ============== Inicio ============== */
  function init() {
    wireButton();
    observeProcModal2Close();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
