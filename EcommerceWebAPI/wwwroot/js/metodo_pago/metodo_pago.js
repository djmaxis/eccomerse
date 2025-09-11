// wwwroot/js/metodo_pago/metodo_pago.js
import { apiListMetodos, apiCreateMetodo, apiUpdateMetodo, apiDeleteMetodo } from './metodo_pago_api.js';

/* =================== Catálogo =================== */
const CATALOGO = [
  { id: 1, code: 'tarjeta', label: 'Tarjeta' },
  { id: 2, code: 'paypal',  label: 'PayPal'  },
];
const codeFromId  = (id) => (CATALOGO.find(x => String(x.id) === String(id))?.code ?? 'tarjeta');
const optionsHtml = (selected) => CATALOGO.map(c =>
  `<option value="${c.id}" ${String(c.id)===String(selected??'') ? 'selected' : ''}>${c.label}</option>`
).join('');

/* =================== Helpers =================== */
const $ = (sel, root=document) => root.querySelector(sel);
const onlyDigits = (s) => (s||'').replace(/\D+/g, '');
function maskCard(num) {
  const d = onlyDigits(num);
  if (!d) return '—';
  return `•••• •••• •••• ${d.slice(-4)}`;
}

/* =================== MODAL add/edit =================== */
function ensureModalCssOnce() {
  if (document.getElementById('mp-modal-style')) return;
  const style = document.createElement('style');
  style.id = 'mp-modal-style';
  style.textContent = `
    .mp-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100;display:flex;align-items:center;justify-content:center}
    .mp-modal{width:min(560px,92vw);background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.2);overflow:hidden}
    .mp-modal header{padding:14px 16px;border-bottom:1px solid #e5e7eb;font-weight:700}
    .mp-modal .body{padding:16px}
    .mp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .mp-grid .full{grid-column:1 / -1}
    .mp-field label{display:block;font-weight:600;margin-bottom:6px;color:#374151}
    .mp-field input[type="text"], .mp-field input[type="tel"], .mp-field select{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;outline:none}
    .mp-field input:focus, .mp-field select:focus{border-color:#0d6efd;box-shadow:0 0 0 3px rgba(13,110,253,.15)}
    .mp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
    .mp-btn{padding:10px 14px;border:none;border-radius:8px;cursor:pointer;font-weight:700}
    .mp-btn.primary{background:#0d6efd;color:#fff}
    .mp-btn.muted{background:#e5e7eb}
    .mp-error{border-color:#ef4444 !important}
  `;
  document.head.appendChild(style);
}

function openMetodoPagoModal(mode, data = null, onSave) {
  ensureModalCssOnce();
  const backdrop = document.createElement('div');
  backdrop.className = 'mp-modal-backdrop';
  backdrop.innerHTML = `
    <div class="mp-modal" role="dialog" aria-modal="true">
      <header>${mode === 'add' ? 'Agregar método de pago' : 'Editar método de pago'}</header>
      <div class="body">
        <div class="mp-grid">
          <div class="mp-field full">
            <label for="mp-alias">Alias</label>
            <input id="mp-alias" type="text" placeholder="Mi tarjeta / Mi PayPal" value="${data?.Nombre ?? data?.nombre ?? ''}">
          </div>
          <div class="mp-field full">
            <label for="mp-metodo">Método</label>
            <select id="mp-metodo">${optionsHtml(
              data ? (String((data.Tipo ?? data.tipo) || '').toLowerCase() === 'paypal' ? 2 : 1) : 1
            )}</select>
          </div>

          <div class="mp-field full" id="mp-paypal-box" style="display:none">
            <label for="mp-email">Email de PayPal</label>
            <input id="mp-email" type="text" placeholder="tu@correo.com" value="${data?.Email ?? data?.email ?? ''}">
          </div>

          <div class="mp-field"><label for="mp-numero-tarjeta">Número de tarjeta</label>
            <input id="mp-numero-tarjeta" type="tel" inputmode="numeric" placeholder="4111 1111 1111 1111" value="${data?.NumeroTarjeta ?? data?.numeroTarjeta ?? ''}">
          </div>
          <div class="mp-field"><label for="mp-cvv">CVV</label>
            <input id="mp-cvv" type="tel" inputmode="numeric" placeholder="123" value="${data?.cvv ?? data?.CVV ?? ''}">
          </div>
          <div class="mp-field"><label for="mp-expmes">Mes</label>
            <input id="mp-expmes" type="tel" inputmode="numeric" placeholder="MM" value="${data?.ExpMes ?? data?.expMes ?? ''}">
          </div>
          <div class="mp-field"><label for="mp-expanio">Año</label>
            <input id="mp-expanio" type="tel" inputmode="numeric" placeholder="YYYY" value="${data?.ExpAnio ?? data?.expAnio ?? ''}">
          </div>

          <div class="mp-field full">
            <label><input id="mp-principal" type="checkbox" ${ (data?.EsPrincipal ?? data?.esPrincipal) ? 'checked' : '' }> Hacer principal</label>
          </div>
        </div>
        <div id="mp-msg" class="muted" style="margin-top:8px;"></div>
        <div class="mp-actions">
          <button class="mp-btn muted" id="mp-cancel">Cancelar</button>
          <button class="mp-btn primary" id="mp-save">${mode === 'add' ? 'Guardar' : 'Actualizar'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const $$ = (sel) => backdrop.querySelector(sel);

  function close() {
    backdrop.remove();
  }

  function toggleFields() {
    const id = parseInt($$('#mp-metodo').value, 10);
    const isPaypal = codeFromId(id) === 'paypal';
    $$('#mp-paypal-box').style.display = isPaypal ? 'block' : 'none';
    ['#mp-numero-tarjeta','#mp-cvv','#mp-expmes','#mp-expanio'].forEach(sel => {
      const el = $$(sel);
      if (el) el.closest('.mp-field').style.display = isPaypal ? 'none' : 'block';
    });
  }
  toggleFields();
  $$('#mp-metodo').addEventListener('change', toggleFields);
  $$('#mp-cancel').addEventListener('click', close);

  function setErr(el, msg) {
    if (!el) return;
    el.classList.add('mp-error');
    const box = $$('#mp-msg');
    box.style.color = '#ef4444';
    box.textContent = msg;
    setTimeout(() => el.classList.remove('mp-error'), 1500);
  }

  function validate() {
    const alias  = $$('#mp-alias')?.value.trim();
    const metodo = codeFromId(parseInt($$('#mp-metodo').value, 10));
    const email  = $$('#mp-email')?.value.trim();
    const numero = onlyDigits($$('#mp-numero-tarjeta')?.value);
    const cvv    = onlyDigits($$('#mp-cvv')?.value);
    const expMes = onlyDigits($$('#mp-expmes')?.value);
    const expAno = onlyDigits($$('#mp-expanio')?.value);

    let ok = true;
    if (!alias) { setErr($$('#mp-alias'), 'Alias obligatorio.'); ok = false; }
    if (metodo === 'tarjeta') {
      if (!numero || numero.length < 13) { setErr($$('#mp-numero-tarjeta'), 'Número inválido.'); ok = false; }
      if (!cvv || cvv.length < 3)       { setErr($$('#mp-cvv'), 'CVV inválido.'); ok = false; }
      if (!expMes || Number(expMes) < 1 || Number(expMes) > 12) { setErr($$('#mp-expmes'),'Mes inválido'); ok = false; }
      if (!expAno || String(expAno).length < 2) { setErr($$('#mp-expanio'), 'Año inválido'); ok = false; }
    } else {
      if (!email || !email.includes('@')) { setErr($$('#mp-email'), 'Email de PayPal válido.'); ok = false; }
    }
    return ok;
  }

  $$('#mp-save').addEventListener('click', async () => {
    if (!validate()) return;

    const idMetodo = parseInt($$('#mp-metodo').value, 10);
    const code     = codeFromId(idMetodo);
    const payload = {
      Nombre: $$('#mp-alias').value.trim(),
      Tipo: code,
      Email: code === 'paypal' ? $$('#mp-email').value.trim() : null,
      NumeroTarjeta: code === 'tarjeta' ? onlyDigits($$('#mp-numero-tarjeta').value) : null,
      cvv: code === 'tarjeta' ? onlyDigits($$('#mp-cvv').value) : null,
      ExpMes: code === 'tarjeta' ? parseInt($$('#mp-expmes').value, 10) : null,
      ExpAnio: code === 'tarjeta' ? parseInt($$('#mp-expanio').value, 10) : null,
      EsPrincipal: $$('#mp-principal').checked
    };

    try {
      await onSave(payload);
      close();
    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Error guardando.';
      const box = $$('#mp-msg');
      box.style.color = '#ef4444';
      box.textContent = msg;
    }
  });
}

/* =================== Render + eventos =================== */
let _clienteId = Number(localStorage.getItem('clienteId') || '1');

function renderLista(items) {
  const cont  = document.querySelector('#lista-metodos');
  const empty = document.querySelector('#mp-empty');
  cont.innerHTML = '';

  if (!items || items.length === 0) {
    if (empty) { empty.style.display = 'block'; empty.textContent = 'Agrega un método de pago'; }
    return;
  }
  if (empty) empty.style.display = 'none';

  items.forEach(it => {
    // normalizar (acepta PascalCase o camelCase)
    const id          = it.IdClienteMetodoPago ?? it.idClienteMetodoPago ?? it.id ?? '';
    const alias       = it.Nombre ?? it.nombre ?? '—';
    const tipoRaw     = String(it.Tipo ?? it.tipo ?? '').toLowerCase();
    const isTarjeta   = tipoRaw === 'tarjeta';
    const numTarjeta  = it.NumeroTarjeta ?? it.numeroTarjeta ?? null;
    const email       = it.Email ?? it.email ?? null;
    const expMes      = it.ExpMes ?? it.expMes ?? null;
    const expAnio     = it.ExpAnio ?? it.expAnio ?? null;
    const esPrincipal = (it.EsPrincipal ?? it.esPrincipal) ? true : false;

    const linea2 = isTarjeta ? (numTarjeta ? maskCard(numTarjeta) : '—') : (email || '—');
    const principal = esPrincipal ? '<span class="badge success">Principal</span>' : '';

    const card = document.createElement('div');
    card.className = 'mp-card';
    card.innerHTML = `
      <div class="mp-info">
        <div class="alias">${alias} ${principal}</div>
        <div class="muted">${isTarjeta ? 'Tarjeta' : 'PayPal'} · ${linea2}</div>
        ${isTarjeta && expMes && expAnio ? `<div class="muted">Exp: ${String(expMes).padStart(2,'0')}/${expAnio}</div>` : ''}
      </div>
      <div class="mp-actions">
        <button class="btn btn-ghost btn-edit" data-id="${id}">
          <i class="fa-regular fa-pen-to-square"></i> Editar
        </button>
        <button class="btn btn-ghost btn-del" data-id="${id}">
          <i class="fa-regular fa-trash-can"></i> Eliminar
        </button>
      </div>
    `;
    cont.appendChild(card);
  });
}

async function cargarLista() {
  const items = await apiListMetodos(_clienteId);
  renderLista(items);
}

function bindEvents() {
  // Agregar
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-add-mp');
    if (!btn) return;
    e.preventDefault();
    openMetodoPagoModal('add', null, async (payload) => {
      await apiCreateMetodo(_clienteId, payload);
      await cargarLista();

      // Mensaje de éxito
      const box = document.getElementById('mp-empty');
      if (box) {
        box.style.color = '#16a34a';
        box.textContent = 'Método de pago agregado correctamente';
        setTimeout(() => {
          box.style.color = '#6b7280';
          box.textContent = (document.querySelectorAll('#lista-metodos .mp-card').length === 0)
            ? 'Agrega un método de pago'
            : '';
        }, 3000);
      }
    });
  });

  // Editar
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-edit');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const lista = await apiListMetodos(_clienteId);
    const data  = lista.find(x =>
      String(x.IdClienteMetodoPago ?? x.idClienteMetodoPago ?? x.id) === String(id)
    );
    if (!data) return;

    openMetodoPagoModal('edit', data, async (payload) => {
      await apiUpdateMetodo(_clienteId, id, payload);
      await cargarLista();
    });
  });

  // Eliminar
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-del');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!confirm('¿Eliminar este método de pago?')) return;
    await apiDeleteMetodo(_clienteId, id);
    await cargarLista();
  });
}

// Bootstrap de la página
document.addEventListener('DOMContentLoaded', async () => {
  // asegúrate de tener el clienteId en localStorage (main.js ya lo hace)
  _clienteId = Number(localStorage.getItem('clienteId') || '1');
  bindEvents();
  try {
    await cargarLista();
  } catch (err) {
    console.error('[metodo_pago] Error cargando lista:', err);
  }
});
