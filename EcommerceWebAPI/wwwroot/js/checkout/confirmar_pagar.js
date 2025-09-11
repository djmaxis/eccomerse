// wwwroot/js/checkout/confirmar_pagar.js
import {
  apiUrl,
  authHeaders,
  fetchJsonSafe,
  formatNumber,
  isLoggedIn,
  getClienteId,
} from './utils.js';
import { apiGetOpenCart, readGuestCart } from './cart.js';

// ======= DOM refs =======
const els = {
  // Dirección de envío
  shippingBody: document.getElementById('shipping-body'),
  editShippingBtn: document.getElementById('edit-shipping-btn'),
  shippingModal: document.getElementById('shipping-modal'),
  closeShippingModal: document.getElementById('close-shipping-modal'),
  addressesList: document.getElementById('addresses-list'),
  selectAddressBtn: document.getElementById('select-address-btn'),

  // Productos
  productsScroll: document.getElementById('products-scroll'),

  // Métodos de pago
  paymethodsForm: document.getElementById('paymethods-form'),

  // Resumen
  subtotal: document.getElementById('subtotal-amount'),
  shippingAmt: document.getElementById('shipping-amount'),
  total: document.getElementById('total') || document.getElementById('total-amount'),

  // Acciones
  confirmBtn: document.getElementById('confirmar-pagar-btn'),
  feedback: document.getElementById('checkout-feedback'),
};

let STATE = {
  clienteId: null,
  direcciones: [],
  direccionSeleccionadaId: null,
  metodosPago: [],
  metodoPagoSeleccionadoId: null,
  carrito: { items: [] },
};

function setFeedback(text, type = 'info') {
  if (!els.feedback) return;
  els.feedback.textContent = text || '';
  els.feedback.style.color =
    type === 'error' ? '#dc3545' : type === 'success' ? '#20c997' : '#6c757d';
}

/* ===================== DIRECCIONES ===================== */
async function fetchDirecciones() {
  if (!STATE.clienteId) { renderDireccionEnvio(null); return; }

  const url = apiUrl(`/api/direcciones?clienteId=${encodeURIComponent(STATE.clienteId)}`);
  const res = await fetchJsonSafe(url, { headers: authHeaders(false) });

  if (res.ok) {
    const arr = Array.isArray(res.data) ? res.data : [];
    STATE.direcciones = arr;

    const first = arr[0] || null;         // ⬅️ SIEMPRE la primera de arriba
    if (first) {
      const firstId = first.IdDireccion ?? first.idDireccion ?? first.id;
      STATE.direccionSeleccionadaId = firstId;
      renderDireccionEnvio(first);        // ⬅️ pinta ya el panel
    } else {
      STATE.direccionSeleccionadaId = null;
      renderDireccionEnvio(null);
    }
  } else {
    STATE.direcciones = [];
    STATE.direccionSeleccionadaId = null;
    renderDireccionEnvio(null);
  }
}



function formatDireccion(d) {
  if (!d) return '';
  const nombre = d.Nombre ?? d.nombre ?? '';
  const tel    = d.Telefono ?? d.telefono ?? '';
  const calle  = d.Calle ?? d.calle ?? '';
  const ciudad = d.Ciudad ?? d.ciudad ?? '';
  const cp     = d.CodigoPostal ?? d.codigoPostal ?? '';
  const pais   = d.Pais ?? d.pais ?? '';
  return `
    <div class="shipping-line">
      <span class="pill brand">${nombre || '—'}</span>
      ${tel ? `<span class="muted">${tel}</span>` : ''}
    </div>
    <div class="shipping-line"><span>${calle}</span></div>
    <div class="shipping-line"><span>${ciudad}${cp ? ', ' + cp : ''}${pais ? ', ' + pais : ''}</span></div>
  `;
}

function renderDireccionEnvio(dir) {
  if (!els.shippingBody) return;
  if (!dir) {
    els.shippingBody.innerHTML = `<div class="shipping-line"><span class="muted">No tienes direcciones registradas.</span></div>`;
    return;
  }
  els.shippingBody.innerHTML = formatDireccion(dir);
}

function openShippingModal() {
  els.shippingModal?.removeAttribute('hidden');
}
function closeShippingModal() {
  els.shippingModal?.setAttribute('hidden', '');
}

function renderAddressModalList() {
  if (!els.addressesList) return;

  const arr = Array.isArray(STATE.direcciones) ? STATE.direcciones : [];
  if (!arr.length) {
    els.addressesList.innerHTML = `<p class="muted">No hay direcciones.</p>`;
    return;
  }

  // ⬅️ Si no hay seleccionada aún, toma la primera y refleja en el panel
  if (!STATE.direccionSeleccionadaId) {
    const first = arr[0];
    const firstId = first.IdDireccion ?? first.idDireccion ?? first.id;
    STATE.direccionSeleccionadaId = firstId;
    renderDireccionEnvio(first); // actualiza “Dirección de envío”
  }

const html = arr.map((d, idx) => {
  const id = d.IdDireccion ?? d.idDireccion ?? d.id;
  const checked = idx === 0; // ⬅️ fuerza la primera marcada
  return `
    <label class="addr-option" style="display:flex;gap:10px;align-items:flex-start;margin:8px 0;">
      <input type="radio" name="addr" value="${id}" ${checked ? 'checked' : ''} />
      <div class="addr-text">
        ${formatDireccion(d)}
        ${(d.EsPrincipal || d.esPrincipal) ? `<span class="pill" style="background:#0d6efd;color:#fff">Principal</span>` : ''}
      </div>
    </label>
    <hr>
  `;
}).join('');

  els.addressesList.innerHTML = html;
}

/* ===================== CARRITO ===================== */
async function fetchCarrito() {
  if (isLoggedIn()) {
    const got = await apiGetOpenCart();
    STATE.carrito = got.ok ? (got.data || { items: [] }) : { items: [] };
  } else {
    STATE.carrito = readGuestCart();
  }
}

function mapCartItems(cartDto) {
  const arr = cartDto?.items || cartDto?.Items || [];
  return arr.map(x => {
    const nombre = x.nombre ?? x.Nombre ?? x.name ?? x.Name ?? 'Producto';
    const qty    = Number(x.cantidad ?? x.Cantidad ?? x.qty ?? 1);
    const price  = Number(x.precioUnitario ?? x.PrecioUnitario ?? x.price ?? 0);
    const img    = x.imagenUrl ?? x.ImagenUrl ?? x.img ?? 'img/placeholder.jpg';
    return { nombre, qty, price, img };
  });
}

function renderProductos(items) {
  if (!els.productsScroll) return;
  if (!items.length) {
    els.productsScroll.innerHTML = `<p class="muted" style="padding:12px">Carrito vacío.</p>`;
    return;
  }
  const frag = items.map(it => `
    <article class="product-mini">
      <img src="${it.img}" alt="${it.nombre}" class="pm-thumb"/>
      <div class="pm-info">
        <div class="pm-title">${it.nombre}</div>
        <div class="pm-meta">
          <span class="price">$${formatNumber(it.price,2)}</span>
          <span class="muted">x ${it.qty}</span>
        </div>
      </div>
    </article>
  `).join('');
  els.productsScroll.innerHTML = frag;
}

/* ===================== MÉTODOS DE PAGO ===================== */
async function fetchMetodosPago() {
  if (!STATE.clienteId) return;

  const url = apiUrl(`/api/clientes/${encodeURIComponent(STATE.clienteId)}/metodos-pago`);
  const res = await fetchJsonSafe(url, { headers: authHeaders(false) });

  STATE.metodosPago = (res.ok && Array.isArray(res.data)) ? res.data : [];

  // ⬅️ Fuerza SIEMPRE el primero (sin depender de EsPrincipal)
  const first = STATE.metodosPago[0] || null;
  STATE.metodoPagoSeleccionadoId = first
    ? (first.IdClienteMetodoPago ?? first.id ?? first.Id ?? null)
    : null;
}

function renderMetodosPago() {
  if (!els.paymethodsForm) return;

  if (!isLoggedIn()) {
    els.paymethodsForm.innerHTML = `<p class="muted">Inicia sesión para seleccionar un método de pago.</p>`;
    return;
  }
  if (!STATE.metodosPago.length) {
    els.paymethodsForm.innerHTML = `<p class="muted">No tienes métodos de pago. Agrega uno en tu perfil.</p>`;
    return;
  }

  const html = STATE.metodosPago.map((m, idx) => {
    const id    = m.IdClienteMetodoPago ?? m.id ?? m.Id;
    const tipo  = (m.Tipo ?? m.tipo ?? '').toLowerCase();
    const alias = m.Nombre ?? m.nombre ?? m.Alias ?? m.alias ?? 'Método de pago';
    const mask  = m.NumeroEnmascarado ?? m.numeroEnmascarado ?? m.NumeroTarjeta ?? m.numeroTarjeta ?? m.Masked ?? m.masked ?? null;
    const email = m.Email ?? m.email ?? null;

    const isCard = tipo === 'tarjeta';
    const label  = isCard ? `${alias} — ${mask ? mask : '••••'}` : `${alias}${email ? ' — ' + email : ''}`;
    const icon   = isCard ? `<i class="fa-regular fa-credit-card"></i>` : `<i class="fa-brands fa-paypal"></i>`;

    const checked = (String(id) === String(STATE.metodoPagoSeleccionadoId)) || idx === 0;

    return `
      <label class="pmethod">
        <input type="radio" name="paymethod" value="${id}" ${checked ? 'checked' : ''}/>
        <span class="pmethod-ui">
          ${icon}
          <span>${label}</span>
        </span>
      </label>
    `;
  }).join('');

  els.paymethodsForm.innerHTML = html;

  // 🔹 Seleccionar siempre el primer radio si existe
const firstRadio = els.paymethodsForm.querySelector('input[name="paymethod"]');
if (firstRadio) {
  firstRadio.checked = true;
  STATE.metodoPagoSeleccionadoId = firstRadio.value;
}
  // Actualizar el estado al cambiar
  els.paymethodsForm.querySelectorAll('input[name="paymethod"]').forEach(radio => {
    radio.addEventListener('change', () => {
      STATE.metodoPagoSeleccionadoId = radio.value;
    });
  });
}


/* ===================== RESUMEN ===================== */
function calcularYRenderTotales(items) {
  const subtotal = items.reduce((acc, it) => acc + Number(it.price) * Number(it.qty), 0);
  const envio = 0;
  const total = subtotal + envio;
  if (els.subtotal)   els.subtotal.textContent   = `$${formatNumber(subtotal,2)}`;
  if (els.shippingAmt)els.shippingAmt.textContent= `$${formatNumber(envio,2)}`;
  if (els.total)      els.total.textContent      = `$${formatNumber(total,2)}`;
}

/* ===================== UI & EVENTOS ===================== */

 async function marcarDireccionPrincipal(idDireccion) {
   const url = apiUrl(`/api/direcciones/${encodeURIComponent(idDireccion)}/principal`);
   const res = await fetchJsonSafe(url, { method: 'PATCH', headers: authHeaders(false) });
   if (!res.ok) throw new Error('No se pudo marcar como principal');
   // Re-cargar para que la principal quede primera y refrescar el panel
   await fetchDirecciones();
 }

function wireUI() {
els.editShippingBtn?.addEventListener('click', async () => {
  if (!isLoggedIn()) {
    setFeedback('Inicia sesión para gestionar direcciones.', 'error');
    return;
  }
  // Trae el arreglo completo cada vez, por si hubo cambios
  await fetchDirecciones();
  console.log('[checkout] direcciones:', STATE.direcciones?.length, STATE.direcciones);
  renderAddressModalList();
  openShippingModal();
});
  els.closeShippingModal?.addEventListener('click', closeShippingModal);
  els.shippingModal?.addEventListener('click', (e) => { if (e.target === els.shippingModal) closeShippingModal(); });
  els.selectAddressBtn?.addEventListener('click', async () => {
    const sel = els.addressesList?.querySelector('input[name="addr"]:checked');
    if (!sel) { setFeedback('Elige una dirección.', 'error'); return; }
    try {
      const idDir = sel.value;
      await marcarDireccionPrincipal(idDir);
      STATE.direccionSeleccionadaId = idDir;
      closeShippingModal();
      setFeedback('Dirección seleccionada.', 'success');
    } catch {
      setFeedback('No se pudo actualizar la dirección principal.', 'error');
    }
  });
  els.confirmBtn?.addEventListener('click', onConfirmarPagar);

  // 🔁 Cuando el carrito cambie (eliminar/aumentar/disminuir) refrescamos productos + totales
  document.addEventListener('cart:changed', (ev) => {
    const snap = ev?.detail?.cart || readGuestCart();
    STATE.carrito = snap;
    const items = mapCartItems(snap);
    renderProductos(items);
    calcularYRenderTotales(items);
  });
}

/* ===================== CONFIRMAR (demo) ===================== */
async function onConfirmarPagar() {
  try {
    setFeedback('');
    if (!STATE.carrito?.items?.length) { setFeedback('Tu carrito está vacío.', 'error'); return; }
    if (isLoggedIn()) {
      if (!STATE.direccionSeleccionadaId) { setFeedback('Selecciona una dirección de envío.', 'error'); return; }
      if (!STATE.metodoPagoSeleccionadoId) { setFeedback('Selecciona un método de pago.', 'error'); return; }
    }
    setFeedback('✅ Pedido listo para confirmar (demo). Integra aquí tu POST /api/ordenes.', 'success');
  } catch (err) {
    console.error(err);
    setFeedback('Ocurrió un error al confirmar el pedido.', 'error');
  }
}

/* ===================== INIT ===================== */
async function init() {
  STATE.clienteId = isLoggedIn() ? (parseInt(getClienteId(), 10) || null) : null;

  // 1) Carrito → productos + totales
  await fetchCarrito();
  const items = mapCartItems(STATE.carrito);
  renderProductos(items);
  calcularYRenderTotales(items);

  // 2) Direcciones (si logueado)
  if (isLoggedIn()) await fetchDirecciones(); else renderDireccionEnvio(null);

  // 3) Métodos de pago (si logueado)
  if (isLoggedIn()) { await fetchMetodosPago(); renderMetodosPago(); }
  else { renderMetodosPago(); } // mensaje "inicia sesión"

  wireUI();
}
document.addEventListener('DOMContentLoaded', init);
