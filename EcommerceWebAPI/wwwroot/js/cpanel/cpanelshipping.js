// wwwroot/js/cpanel/cpanelshipping.js
(() => {
  const qs  = (s, el = document) => el.querySelector(s);
  const LOG  = (...a) => console.log('%c[shipping]', 'color:#2563eb;font-weight:bold', ...a);
  const WARN = (...a) => console.warn('%c[shipping]', 'color:#d97706;font-weight:bold', ...a);
  const ERR  = (...a) => console.error('%c[shipping]', 'color:#ef4444;font-weight:bold', ...a);

  const fmtBadgeStyle = (statusRaw) => {
    const s = (statusRaw || '').toString().trim().toLowerCase();
    if (s.startsWith('cancel')) return 'background:#FF5C5C;color:#fff';
    if (s.startsWith('complet')) return 'background:#CFCFCF;color:#111';
    if (s.startsWith('envi'))    return 'background:#FFDD8A;color:#111';
    if (s.startsWith('paga'))    return 'background:#B8F2B1;color:#111';
    return 'background:#CFCFCF;color:#111';
  };

  const API = {
    pendientes: (q='', take=50) => fetch(`/api/shipping/pending?q=${encodeURIComponent(q)}&take=${take}`, { cache:'no-store' }),
    enviadas:   (q='', take=50) => fetch(`/api/shipping/shipped?q=${encodeURIComponent(q)}&take=${take}`, { cache:'no-store' }),
    addTrk:     (id, body)      => fetch(`/api/shipping/${id}/tracking`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }),
    updTrk:     (id, body)      => fetch(`/api/shipping/${id}/tracking`, { method:'PUT',  headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }),
  };

  function setUserLabel() {
    const n = qs('#userLabel');
    if (n) n.textContent = localStorage.getItem('nombre') || localStorage.getItem('correo') || 'Usuario';
  }
  function setupLogout() {
    qs('#btnLogout')?.addEventListener('click', (e) => {
      e.preventDefault();
      try { localStorage.clear(); sessionStorage.clear(); } catch {}
      location.replace('index.html?logout=' + Date.now());
    });
  }

  function paintPendientes(rows=[]) {
    const tb = qs('#tblPendientes tbody'); if (!tb) return;
    LOG('paintPendientes:rows', rows);
    tb.innerHTML = rows.map(r => `
      <tr>
        <td>${r.noOrden}</td>
        <td>${r.cliente}</td>
        <td>${r.fecha}</td>
        <td><span class="badge" style="${fmtBadgeStyle(r.estatus)}">${r.estatus}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-yellow"    data-action="add-trk" data-id="${r.idEstatusOrden}" data-no="${r.noOrden}">Añadir tracking</button>
            <button class="btn btn-lightblue"
        data-action="ver"
        data-ordenid="${r.idOrden}"
        data-no="${r.noOrden}"
        data-mask="${r.noOrden || ''}">
  Ver orden completa
</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
  function paintEnviadas(rows=[]) {
    const tb = qs('#tblEnviadas tbody'); if (!tb) return;
    LOG('paintEnviadas:rows', rows);
    tb.innerHTML = rows.map(r => `
      <tr>
        <td>${r.noOrden}</td>
        <td>${r.cliente}</td>
        <td>${r.fecha}</td>
        <td><span class="badge" style="${fmtBadgeStyle(r.estatus)}">${r.estatus}</span></td>
        <td>${r.tracking || '-'}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-orange"    data-action="upd-trk" data-id="${r.idEstatusOrden}" data-no="${r.noOrden}" data-trk="${r.tracking || ''}">Actualizar tracking</button>
            <button class="btn btn-lightblue"
        data-action="ver"
        data-ordenid="${r.idOrden}"
        data-no="${r.noOrden}"
        data-mask="${r.noOrden || ''}">
  Ver orden completa
</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function openModalAdd(noOrden, id) {
    LOG('openModalAdd', { noOrden, id });
    qs('#add_err').textContent = '';
    const m = qs('#modalAddTrk'); const bd = qs('#bdAddTrk');
    qs('#add_noOrden').value = noOrden || '';
    qs('#add_tracking').value = '';
    m.classList.add('open'); bd.style.display='block';
    m.dataset.id = id;
  }
  function closeModalAdd() {
    LOG('closeModalAdd');
    const m = qs('#modalAddTrk'); const bd = qs('#bdAddTrk');
    m.classList.remove('open'); bd.style.display='none';
    m.dataset.id = '';
  }
  function openModalUpd(noOrden, id, trk) {
    LOG('openModalUpd', { noOrden, id, trk });
    qs('#upd_err').textContent = '';
    const m = qs('#modalUpdTrk'); const bd = qs('#bdUpdTrk');
    qs('#upd_noOrden').value = noOrden || '';
    qs('#upd_tracking').value = trk || '';
    m.classList.add('open'); bd.style.display='block';
    m.dataset.id = id;
  }
  function closeModalUpd() {
    LOG('closeModalUpd');
    const m = qs('#modalUpdTrk'); const bd = qs('#bdUpdTrk');
    m.classList.remove('open'); bd.style.display='none';
    m.dataset.id = '';
  }

  function setupModals() {
    qs('#btnAddCancel')?.addEventListener('click', closeModalAdd);
    qs('#bdAddTrk')?.addEventListener('click', closeModalAdd);
    qs('#btnUpdCancel')?.addEventListener('click', closeModalUpd);
    qs('#bdUpdTrk')?.addEventListener('click', closeModalUpd);

    qs('#btnAddSave')?.addEventListener('click', async () => {
      const id  = qs('#modalAddTrk')?.dataset.id;
      const trk = (qs('#add_tracking')?.value || '').trim();
      LOG('btnAddSave:click', { id, trkLen: trk.length });
      if (!trk) { qs('#add_err').textContent = 'Tracking requerido.'; return; }
      try {
        const r = await API.addTrk(id, { tracking: trk, estatus: 'Enviada' });
        LOG('btnAddSave:resp', r.status, r.ok);
        if (!r.ok) throw new Error(await r.text());
        closeModalAdd();
        location.reload();
      } catch (e) {
        qs('#add_err').textContent = 'No se pudo guardar el tracking.';
        ERR('btnAddSave:error', e);
      }
    });

    qs('#btnUpdSave')?.addEventListener('click', async () => {
      const id  = qs('#modalUpdTrk')?.dataset.id;
      const trk = (qs('#upd_tracking')?.value || '').trim();
      LOG('btnUpdSave:click', { id, trkLen: trk.length });
      if (!trk) { qs('#upd_err').textContent = 'Tracking requerido.'; return; }
      try {
        const r = await API.updTrk(id, { tracking: trk });
        LOG('btnUpdSave:resp', r.status, r.ok);
        if (!r.ok) throw new Error(await r.text());
        closeModalUpd();
        location.reload();
      } catch (e) {
        qs('#upd_err').textContent = 'No se pudo actualizar el tracking.';
        ERR('btnUpdSave:error', e);
      }
    });
  }

  function setupTableActions() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      LOG('click:data-action', action, 'dataset=', { ...btn.dataset });

      if (action === 'add-trk') { openModalAdd(btn.dataset.no || '', btn.dataset.id); return; }
      if (action === 'upd-trk') { openModalUpd(btn.dataset.no || '', btn.dataset.id, btn.dataset.trk || ''); return; }

if (action === 'ver') {
  const idOrden = parseInt(btn.dataset.ordenid || '0', 10);
  const mask    = btn.dataset.mask || btn.dataset.no;
  LOG('detalles:abrir', { idOrden, no: mask });

  if (!idOrden) { console.warn('detalles: idOrden inválido'); return; }

  if (!window.ShippingDetails || typeof window.ShippingDetails.openByOrderId !== 'function') {
    ERR('detalles: ShippingDetails.openByOrderId NO disponible');
    alert('El módulo de detalles no está cargado.');
    return;
  }
  try {
    await window.ShippingDetails.openByOrderId(idOrden, mask);
    LOG('detalles: abierto ok');
  } catch (err) {
    ERR('detalles: error al abrir', err);
    alert('No se pudo cargar los detalles de la orden.');
  }
}

    });
  }

  function setupSearch() {
    const goPend = () => { const q = (qs('#txtBuscarPendientes')?.value || '').trim(); LOG('search:pendientes', q); reloadPendientes(q).catch(e => ERR('search:pendientes:error', e)); };
    const goEnv  = () => { const q = (qs('#txtBuscarEnviadas')?.value || '').trim(); LOG('search:enviadas', q);  reloadEnviadas(q).catch(e => ERR('search:enviadas:error', e));  };
    qs('#btnBuscarPendientes')?.addEventListener('click', goPend);
    qs('#txtBuscarPendientes')?.addEventListener('keydown', e => { if (e.key === 'Enter') goPend(); });
    qs('#btnBuscarEnviadas')?.addEventListener('click', goEnv);
    qs('#txtBuscarEnviadas')?.addEventListener('keydown', e => { if (e.key === 'Enter') goEnv(); });
  }

  async function reloadPendientes(q='') {
    const r = await API.pendientes(q); LOG('reloadPendientes:status', r.status, r.ok);
    if (!r.ok) throw new Error(await r.text());
    paintPendientes(await r.json());
  }
  async function reloadEnviadas(q='') {
    const r = await API.enviadas(q); LOG('reloadEnviadas:status', r.status, r.ok);
    if (!r.ok) throw new Error(await r.text());
    paintEnviadas(await r.json());
  }
  async function reloadAll() { await Promise.all([reloadPendientes(''), reloadEnviadas('')]); }

  document.addEventListener('DOMContentLoaded', async () => {
    LOG('DOMContentLoaded', { hasShippingDetails: !!window.ShippingDetails, openFn: typeof window.ShippingDetails?.openByOrderId });
    setUserLabel(); setupLogout(); setupModals(); setupTableActions(); setupSearch();
    try { LOG('reloadAll'); await reloadAll(); LOG('reloadAll:done'); } catch (e) { ERR('load error:', e); }
  });
})();
