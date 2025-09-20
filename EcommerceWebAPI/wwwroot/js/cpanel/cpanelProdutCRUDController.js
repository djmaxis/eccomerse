// js/cpanel/cpanelProdutCRUDController.js
// (sin $ ni $$ para no chocar con jQuery/BrowserLink)
const qs  = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];

const API = {
  list: (q='') => fetch(`/api/cpanel/productos?q=${encodeURIComponent(q)}`),
  add:  (b)    => fetch(`/api/cpanel/productos`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b)}),
  edit: (id,b) => fetch(`/api/cpanel/productos/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b)}),
  on:   (id)   => fetch(`/api/cpanel/productos/${id}/activar`,   { method:'PATCH' }),
  off:  (id)   => fetch(`/api/cpanel/productos/${id}/inactivar`, { method:'PATCH' }),
};

const fmtMoney = v => new Intl.NumberFormat('es-DO', { style:'currency', currency:'DOP' }).format(+v || 0);

// ===== Listado =====
async function loadProductos() {
  try {
    const q = qs('#txtSearch')?.value?.trim() || '';
    const res = await API.list(q);
    if (!res.ok) throw new Error(await res.text());
    const items = await res.json();
    paintTable(items);
  } catch (err) {
    console.error('[productos] listar:', err);
    alert('No se pudo listar productos');
  }
}

// Normalizador de imagen
const normImagePath = (v) => {
  let s = (v || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;    // URL absoluta
  if (s.startsWith('image/')) return s;
  if (s.startsWith('img/')) return s;
  if (s.startsWith('/')) s = s.substring(1); // <-- quita primer "/"
  return 'image/' + s;
};


function paintTable(items) {
  const tbody = qs('#tblProductos tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  items.forEach(p => {
    const id  = p.IdProducto ?? p.idProducto;
    const ref = p.RefModelo ?? p.refModelo ?? '';
    const nom = p.Nombre ?? p.nombre ?? '';
    const des = p.Descripcion ?? p.descripcion ?? '';
    const cos = p.Costo ?? p.costo ?? 0;
    const pre = p.Precio ?? p.precio ?? 0;
    const sto = p.Stock ?? p.stock ?? 0;
    const act = (p.Activo ?? p.activo) == 1;
    const img = normImagePath(p.Image ?? p.image ?? ''); // <-- capturamos

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id ?? ''}</td>
      <td>${ref}</td>
      <td>${nom}</td>
      <td>${des}</td>
      <td>${fmtMoney(cos)}</td>
      <td>${fmtMoney(pre)}</td>
      <td>${sto}</td>
      <td>${act ? 'Sí' : 'No'}</td>
      <td>
                 <button class="action-btn action-edit btn-warning"
                 data-id="${id ?? ''}"
                 data-image="${img}"
                 data-costo="${cos}"
                 data-precio="${pre}">
           Edit
         </button>
        ${ act
          ? `<button class="action-btn action-toggle btn-secondary" data-id="${id ?? ''}" data-act="off">Inact.</button>`
          : `<button class="action-btn action-toggle btn-success"   data-id="${id ?? ''}" data-act="on">Acti.</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== Buscar =====
function setupSearch() {
  qs('#btnSearch')?.addEventListener('click', loadProductos);
  qs('#txtSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') loadProductos(); });
}

// ===== Modal =====
function openModal(mode, data=null) {
  const modal = qs('#prodModal'); if (!modal) return;
  modal.classList.add('open');

  qs('#modalTitle').textContent = mode === 'add' ? 'Agregar producto' : 'Editar producto';
  const btnSave = qs('#btnSave'); btnSave.dataset.mode = mode; btnSave.dataset.id = data?.IdProducto ?? data?.idProducto ?? '';

  qs('#mRefModelo').value   = data?.RefModelo   ?? data?.refModelo   ?? '';
  qs('#mNombre').value      = data?.Nombre      ?? data?.nombre      ?? '';
  qs('#mDescripcion').value = data?.Descripcion ?? data?.descripcion ?? '';
  qs('#mCosto').value       = (data?.Costo ?? data?.costo ?? '').toString();
  qs('#mPrecio').value      = (data?.Precio ?? data?.precio ?? '').toString();
  qs('#mStock').value       = (data?.Stock  ?? data?.stock  ?? '').toString();
  qs('#mImage').value       = normImagePath(data?.Image ?? data?.image ?? ''); // <-- aquí
}

function closeModal() {
  qs('#prodModal')?.classList.remove('open');
  qsa('.field-error').forEach(e => e.textContent = '');
}
function setupModal() {
  qs('#btnAddProduct')?.addEventListener('click', () => openModal('add'));
  qs('#btnCloseModal')?.addEventListener('click', closeModal);
  qs('#modalBackdrop')?.addEventListener('click', closeModal);

  qs('#btnSave')?.addEventListener('click', async () => {
    const btnSave = qs('#btnSave');
    const mode = btnSave?.dataset.mode;
    const id   = btnSave?.dataset.id;

    // ===== valores =====
    const RefModelo   = (qs('#mRefModelo')?.value ?? '').trim();
    const Nombre      = (qs('#mNombre')?.value ?? '').trim();
    const Descripcion = (qs('#mDescripcion')?.value ?? '').trim();
    const CostoRaw   = (qs('#mCosto')?.value ?? '').trim();
    const PrecioRaw   = (qs('#mPrecio')?.value ?? '').trim();
    const StockRaw    = (qs('#mStock')?.value ?? '').trim();
    let   Image       = (qs('#mImage')?.value ?? '').trim();

    // ===== parseo numérico =====
    const Costo  = Number((CostoRaw || '').replace(',', '.'));
    const Precio = Number((PrecioRaw || '').replace(',', '.'));
    const Stock  = parseInt(StockRaw || '', 10);

    // ===== validaciones obligatorias =====
    let ok = true;
    const req = (v) => v !== null && v !== undefined && v !== '';

    // texto obligatorios
    setErr('#errRefModelo',   req(RefModelo)   ? '' : (ok = false, 'Requerido'));
    setErr('#errNombre',      req(Nombre)      ? '' : (ok = false, 'Requerido'));
    setErr('#errDescripcion', req(Descripcion) ? '' : (ok = false, 'Requerido'));

    // numéricos obligatorios: NO vacíos y >= 0
    const hasCosto  = (CostoRaw  !== '') && !Number.isNaN(Costo)  && Costo  >= 0;
    const hasPrecio = (PrecioRaw !== '') && !Number.isNaN(Precio) && Precio >= 0;
    const hasStock  = (StockRaw  !== '') && Number.isInteger(Stock) && Stock >= 0;

    setErr('#errCosto',  hasCosto  ? '' : (ok = false, 'Requerido (≥ 0)'));
    setErr('#errPrecio', hasPrecio ? '' : (ok = false, 'Requerido (≥ 0)'));
    setErr('#errStock',  hasStock  ? '' : (ok = false, 'Requerido (≥ 0)'));

    if (!ok) return;

    // ===== normalizar imagen =====
    if (Image) {
      if (!/^https?:\/\//i.test(Image)) {
        if (Image.startsWith('/')) Image = Image.slice(1);     // quita primer '/'
        if (!/^image\//i.test(Image) && !/^img\//i.test(Image)) {
          Image = 'image/' + Image;
        }
      }
    }

    const payload = { RefModelo, Nombre, Descripcion, Costo, Precio, Stock, Image: Image || null };

    try {
      const resp = (mode === 'add') ? await API.add(payload) : await API.edit(id, payload);
      if (!resp.ok) throw new Error(await resp.text());
      closeModal();
      await loadProductos();
    } catch (err) {
      console.error('[productos] guardar:', err);
      alert(err?.message || 'No se pudo guardar el producto');
    }
  });

  function setErr(sel, msg) {
    const e = qs(sel);
    if (e) {
      e.textContent = msg;
      e.style.color = msg ? 'red' : '';
    }
  }
}


// ===== Acciones en la tabla =====
function setupTableActions() {
  const tbody = qs('#tblProductos tbody');
  if (!tbody) return;

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) { alert('Id de producto no definido'); return; }

if (btn.classList.contains('action-edit')) {
  const tr = btn.closest('tr');
  const cells = tr.querySelectorAll('td');
  const data = {
    IdProducto: parseInt(id,10),
    RefModelo: cells[1]?.textContent?.trim() ?? '',
    Nombre: cells[2]?.textContent?.trim() ?? '',
    Descripcion: cells[3]?.textContent?.trim() ?? '',
    Costo: parseFloat(btn.dataset.costo ?? '0') || 0,
    Precio: parseFloat(btn.dataset.precio ?? '0') || 0,
    Stock: parseInt(cells[5]?.textContent,10) || 0,
    Image: btn.dataset.image || '' // <-- ahora cargamos imagen
  };
  openModal('edit', data);
  return;
}


    if (btn.classList.contains('action-toggle')) {
      try {
        const act = btn.dataset.act; // 'on'|'off'
        const res = await (act === 'on' ? API.on(id) : API.off(id));
        if (!res.ok) throw new Error(await res.text());
        await loadProductos();
      } catch (err) {
        console.error('[productos] activar/inactivar:', err);
        alert('No se pudo cambiar el estado');
      }
    }
  });
}

// ==== Boot ====
document.addEventListener('DOMContentLoaded', () => {
  setupSearch();
  setupModal();
  setupTableActions();
  loadProductos();
});
