// js/mi_perfil/direcciones.js
  const PAISES = ["Republica Dominicana"]; // único país del catálogo
  const CIUDADES = [
    "Bajos de Hainas","Baní","Barahona","Bayaguana","Boca Chica","Bonao","Constanza","Cotuí","Dajabón",
    "Distrito Nacional","El Seibo","Esperanza","Gaspar Hernández","Guayubín","Hato Mayor","Higuey","Jarabacoa",
    "La Mata","La Romana","La Vega","Las Matas de Farfán","Los Alcarrizos","Mao","Moca","Monte Cristi","Monte Plata",
    "Nagua","Neiba","Pedro Brand","Puerto Plata","Puñal","Salcedo","Samaná","San Antonio de Guerra","San Cristóbal",
    "San Francisco de Macorís","San Ignacio de Sabanate","San José de las Matas","San José de Ocoa","San Juan",
    "San Pedro de Macorís","Santiago de los Caballeros","Santo Domingo Este","Santo Domingo Norte","Santo Domingo Oeste",
    "Sosúa","Tamboril","Tenares","Villa Altagracia","Villa Bisonó","Villa González","Villa Hermosa","Villa Riva","Yamasá"
  ];

// js/mi_perfil/direcciones.js
(function(){
  // ====== Catálogos embebidos (desde pais.txt y ciudades.txt) ======
  // OJO: Todo se mantiene en este mismo archivo como pediste.
  const PAISES = ["Republica Dominicana"]; // único país del catálogo
  const CIUDADES = [
    "Bajos de Hainas","Baní","Barahona","Bayaguana","Boca Chica","Bonao","Constanza","Cotuí","Dajabón",
    "Distrito Nacional","El Seibo","Esperanza","Gaspar Hernández","Guayubín","Hato Mayor","Higuey","Jarabacoa",
    "La Mata","La Romana","La Vega","Las Matas de Farfán","Los Alcarrizos","Mao","Moca","Monte Cristi","Monte Plata",
    "Nagua","Neiba","Pedro Brand","Puerto Plata","Puñal","Salcedo","Samaná","San Antonio de Guerra","San Cristóbal",
    "San Francisco de Macorís","San Ignacio de Sabanate","San José de las Matas","San José de Ocoa","San Juan",
    "San Pedro de Macorís","Santiago de los Caballeros","Santo Domingo Este","Santo Domingo Norte","Santo Domingo Oeste",
    "Sosúa","Tamboril","Tenares","Villa Altagracia","Villa Bisonó","Villa González","Villa Hermosa","Villa Riva","Yamasá"
  ];

  // ===== util: clienteId =====
  function getStoredId(){
    const raw = localStorage.getItem('clienteId') || localStorage.getItem('idCliente');
    return raw ? parseInt(raw, 10) : null;
  }
  function tryExtractIdFromJwt(){
    const tok = localStorage.getItem('token');
    if (!tok) return null;
    try {
      const p = JSON.parse(atob(tok.split('.')[1] || ''));
      const v = p.sub || p.nameid || p.userId || p.idCliente || p.clienteId;
      if (v != null) { localStorage.setItem('clienteId', String(v)); return parseInt(v,10); }
    } catch {}
    return null;
  }
  async function tryGetIdFromMe(){
    try {
      const r = await fetch('/api/clientes/me',{ headers:{Accept:'application/json'}, credentials:'include' });
      if (!r.ok) return null;
      const me = await r.json();
      const id = me?.idCliente ?? me?.id ?? null;
      if (id != null) { localStorage.setItem('clienteId', String(id)); return parseInt(id,10); }
    } catch {}
    return null;
  }
  async function getClienteId(){
    return getStoredId() ?? tryExtractIdFromJwt() ?? await tryGetIdFromMe();
  }

  // ===== hooks UI =====
  const seccionDirecciones = Array.from(document.querySelectorAll('.perfil-section'))
    .find(s => s.querySelector('h2')?.textContent?.trim().toLowerCase() === 'direcciones');
  if (!seccionDirecciones) return;

  const btnAgregar = seccionDirecciones.querySelector('.btn-primary'); // el botón “Agregar”
  const listaWrap  = seccionDirecciones.querySelector('.lista-items');
  const ul         = listaWrap?.querySelector('ul');

  // ===== mini CSS del modal (namespaced) =====
  const css = `
  .dir-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100;display:flex;align-items:center;justify-content:center}
  .dir-modal{width:min(560px,92vw);background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.2);overflow:hidden}
  .dir-modal header{padding:14px 16px;border-bottom:1px solid #e5e7eb;font-weight:700}
  .dir-modal .body{padding:16px}
  .dir-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .dir-grid .full{grid-column:1 / -1}
  .dir-field label{display:block;font-weight:600;margin-bottom:6px;color:#374151}
  .dir-field input[type="text"], .dir-field input[type="tel"], .dir-field select{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;outline:none;background:#fff}
  .dir-field input:focus, .dir-field select:focus{border-color:#0d6efd;box-shadow:0 0 0 3px rgba(13,110,253,.15)}
  .dir-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
  .dir-btn{padding:10px 14px;border:none;border-radius:8px;cursor:pointer;font-weight:700}
  .dir-btn.primary{background:#0d6efd;color:#fff}
  .dir-btn.muted{background:#e5e7eb}
  .dir-tag{margin-left:8px;padding:2px 6px;border-radius:6px;background:#dcfce7;color:#166534;font-size:.75rem}
  .dir-row{display:flex;align-items:center;gap:8px}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ===== helpers =====
  const headers = (json=true)=>{
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    const t = localStorage.getItem('token');
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  };
  const composeLine = d => `${d.Calle || d.calle}, ${d.Ciudad || d.ciudad}, ${d.Pais || d.pais}${(d.CodigoPostal||d.codigoPostal) ? ' '+(d.CodigoPostal||d.codigoPostal) : ''}`;

  function render(list){
    if (!ul) return;
    ul.innerHTML = '';
    if (!list || list.length === 0){
      ul.innerHTML = `<li>No tienes direcciones registradas.</li>`;
      return;
    }
    list.forEach(d=>{
      const li = document.createElement('li');
      const principal = d.EsPrincipal ?? d.esPrincipal;
      li.innerHTML = `
        <div class="dir-row" style="flex:1">
          <strong>${(d.Nombre ?? d.nombre) || ''}</strong>
          ${principal ? '<span class="dir-tag">Principal</span>' : ''}
          <span style="color:#6b7280">— ${composeLine(d)}</span>
        </div>
        <div>
          <button class="btn-editar">Editar</button>
          <button class="btn-eliminar">Eliminar</button>
        </div>
      `;
      li.querySelector('.btn-editar').addEventListener('click', ()=> openModal('edit', d));
      li.querySelector('.btn-eliminar').addEventListener('click', async ()=>{
        if (!confirm('¿Eliminar esta dirección?')) return;
        await eliminar(d.IdDireccion ?? d.idDireccion);
        await cargar();
      });
      ul.appendChild(li);
    });
  }

  // ===== API calls =====
  async function cargar(){
    const clienteId = await getClienteId();
    if (!clienteId) { if (ul) ul.innerHTML = '<li>No se pudo determinar tu sesión.</li>'; return; }
    const r = await fetch(`/api/direcciones?clienteId=${clienteId}`, { headers:{Accept:'application/json', ...headers(false)}, credentials:'include' });
    if (!r.ok) { ul.innerHTML = '<li>Aun no has añadido direcciones.</li>'; return; }
    const list = await r.json();
    render(list);
  }
  async function crear(payload){
    const r = await fetch('/api/direcciones', { method:'POST', headers: headers(true), credentials:'include', body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(await r.text().catch(()=> 'Error al crear'));
    return r.json();
  }
  async function actualizar(id, payload){
    payload.IdDireccion = id;
    const r = await fetch(`/api/direcciones/${id}`, { method:'PUT', headers: headers(true), credentials:'include', body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(await r.text().catch(()=> 'Error al actualizar'));
    return r.json();
  }
  async function eliminar(id){
    const r = await fetch(`/api/direcciones/${id}`, { method:'DELETE', headers: headers(false), credentials:'include' });
    if (!r.ok) throw new Error(await r.text().catch(()=> 'Error al eliminar'));
  }

  // ===== util selects =====
  function fillSelect(selectEl, items, selectedValue){
    if (!selectEl) return;
    selectEl.innerHTML = '';
    // placeholder
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = '-- Selecciona --';
    selectEl.appendChild(ph);
    items.forEach(v=>{
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      if (selectedValue && String(selectedValue).trim().toLowerCase() === v.toLowerCase()){
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  // ===== Modal =====
  function openModal(mode, data){
    const isEdit = mode === 'edit';
    const title  = isEdit ? 'Editar dirección' : 'Agregar dirección';
    const clienteId = getStoredId();

    const wrap = document.createElement('div');
    wrap.className = 'dir-modal-backdrop';
    wrap.innerHTML = `
      <div class="dir-modal" role="dialog" aria-modal="true" aria-label="${title}">
        <header>${title}</header>
        <div class="body">
          <div class="dir-grid">
            <div class="dir-field full">
              <label>Nombre</label>
              <input type="text" id="dir-nombre" value="${(data?.Nombre ?? data?.nombre) ?? ''}">
            </div>
            <div class="dir-field full">
              <label>Calle</label>
              <input type="text" id="dir-calle" value="${(data?.Calle ?? data?.calle) ?? ''}">
            </div>
            <div class="dir-field">
              <label>País</label>
              <select id="dir-pais"></select>
            </div>
            <div class="dir-field">
              <label>Ciudad</label>
              <select id="dir-ciudad"></select>
            </div>
            <div class="dir-field">
              <label>Código postal</label>
              <input type="text" id="dir-cp" value="${(data?.CodigoPostal ?? data?.codigoPostal) ?? ''}">
            </div>
            <div class="dir-field">
              <label>Teléfono</label>
              <input type="tel" id="dir-phone" value="${(data?.Telefono ?? data?.telefono) ?? ''}">
            </div>
            <div class="dir-field full" style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <input type="checkbox" id="dir-principal" ${ (data?.EsPrincipal ?? data?.esPrincipal) ? 'checked':'' }>
              <label for="dir-principal" style="margin:0">Marcar como principal</label>
            </div>
          </div>
          <div id="dir-msg" style="margin-top:8px;font-size:.9rem;color:#b91c1c"></div>
          <div class="dir-actions">
            <button class="dir-btn muted" id="dir-cancel">Cancelar</button>
            <button class="dir-btn primary" id="dir-save">${isEdit ? 'Guardar' : 'Agregar'}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const $ = (sel)=> wrap.querySelector(sel);
    const close = ()=> wrap.remove();

    // Inicializar selects con catálogos embebidos
    fillSelect($('#dir-pais'), PAISES, (data?.Pais ?? data?.pais) || 'Republica Dominicana');
    fillSelect($('#dir-ciudad'), CIUDADES, (data?.Ciudad ?? data?.ciudad) || '');

    $('#dir-cancel').addEventListener('click', close);
    wrap.addEventListener('click', (e)=> { if (e.target === wrap) close(); });
    document.addEventListener('keydown', escClose, true);
    function escClose(e){ if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose, true);} }

    $('#dir-save').addEventListener('click', async ()=>{
      const nombre = $('#dir-nombre').value.trim();
      const calle  = $('#dir-calle').value.trim();
      const pais   = $('#dir-pais').value.trim();
      const ciudad = $('#dir-ciudad').value.trim();
      const cp     = $('#dir-cp').value.trim();
      const phone  = $('#dir-phone').value.trim();
      const principal = $('#dir-principal').checked;

      const msg = $('#dir-msg');
      msg.style.color = '#b91c1c'; msg.textContent = '';

      if (nombre.length < 3){ msg.textContent = 'Nombre inválido (mín. 3).'; return; }
      if (!calle){ msg.textContent = 'Calle requerida.'; return; }
      if (!pais){ msg.textContent = 'País requerido.'; return; }
      if (!ciudad){ msg.textContent = 'Ciudad requerida.'; return; }

      const payload = {
        IdCliente: data?.IdCliente ?? data?.idCliente ?? clienteId,
        Nombre: nombre,
        Calle: calle,
        Pais: pais,
        Ciudad: ciudad,
        CodigoPostal: cp || null,
        Telefono: phone || null,
        EsPrincipal: principal
      };

      try{
        if (isEdit){
          await actualizar(data.IdDireccion ?? data.idDireccion, payload);
        } else {
          await crear(payload);
        }
        close();
        await cargar();
      }catch(err){
        msg.textContent = (err?.message || 'Error al guardar');
      }
    });
  }

  // ===== eventos =====
  if (btnAgregar){
    btnAgregar.addEventListener('click', ()=> openModal('add'));
  }

  // ===== boot =====
  cargar();
})();
