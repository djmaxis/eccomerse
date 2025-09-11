// js/mi_perfil/update_perfil.js
(function () {
  // ===== ENDPOINTS (relativos, mismo origen) =====
  const GET_CLIENTE_BY_ID = (id) => `/api/clientes/${id}`;
  const PATCH_NOMBRE_BY_ID = (id) => `/api/clientes/${id}/nombre`;
  const PUT_CLIENTE_BY_ID   = (id) => `/api/clientes/${id}`;
  const GET_ME = `/api/clientes/me`; // opcional si lo habilitas

  // ===== Headers con token y X-Cliente-Id (compat) =====
  function authHeaders(withJson = true) {
    const h = {};
    if (withJson) h['Content-Type'] = 'application/json';
    const tok = localStorage.getItem('token');
    if (tok) h['Authorization'] = `Bearer ${tok}`;
    const cid = localStorage.getItem('clienteId') || localStorage.getItem('idCliente');
    if (cid) h['X-Cliente-Id'] = String(cid); // útil si backend lo usa
    return h;
  }

  // ===== Obtener/derivar Id de cliente =====
  function tryExtractIdFromJwt() {
    const tok = localStorage.getItem('token');
    if (!tok) return null;
    try {
      const payload = JSON.parse(atob(tok.split('.')[1] || ''));
      const v = payload.sub || payload.nameid || payload.userId || payload.idCliente || payload.clienteId;
      if (v != null) {
        localStorage.setItem('clienteId', String(v));
        return parseInt(v, 10);
      }
    } catch {}
    return null;
  }

  async function tryGetIdFromMe() {
    try {
      const r = await fetch(GET_ME, { headers: { Accept: 'application/json', ...authHeaders(false) }, credentials: 'include' });
      if (!r.ok) return null;
      const me = await r.json();
      const id = me?.idCliente ?? me?.id ?? null;
      if (id != null) localStorage.setItem('clienteId', String(id));
      return id != null ? parseInt(id, 10) : null;
    } catch { return null; }
  }

  async function getClienteId() {
    let raw = localStorage.getItem('clienteId') || localStorage.getItem('idCliente');
    if (raw) return parseInt(raw, 10);
    const fromJwt = tryExtractIdFromJwt();
    if (fromJwt) return fromJwt;
    const fromMe = await tryGetIdFromMe();
    if (fromMe) return fromMe;
    return null;
  }

  // ===== DOM =====
  const inputNombre = document.getElementById('nombre');
  const btn = document.getElementById('btn-actualizar-nombre')
    || (document.querySelector('.perfil-section button.btn-primary')); // fallback
  const navbarUserName = document.getElementById('user-name');

  // Mensaje bajo el input
  let msg = document.getElementById('nombre-status');
  if (!msg && inputNombre) {
    msg = document.createElement('div');
    msg.id = 'nombre-status';
    msg.style.marginTop = '8px';
    msg.style.fontSize = '.9rem';
    inputNombre.parentElement.appendChild(msg);
  }
  const setMsg = (t, type='info')=>{
    if (!msg) return;
    msg.textContent = t || '';
    msg.style.color = type==='error' ? '#b91c1c' : (type==='success' ? '#166534' : '#374151');
  };

  // ===== Validación =====
  const validarNombre = (val) => {
    const nombre = (val ?? '').trim();
    if (nombre.length < 4) return { ok:false, msg:'El nombre debe tener más de 3 caracteres.' };
    return { ok:true, nombre };
  };

  // ===== Carga inicial =====
  async function cargarNombre() {
    if (!inputNombre) return;
    const id = await getClienteId();
    if (id) {
      try {
        const r = await fetch(GET_CLIENTE_BY_ID(id), {
          headers: { Accept:'application/json', ...authHeaders(false) },
          credentials: 'include',
        });
        if (r.ok) {
          const c = await r.json();
          inputNombre.value = (c.nombre || c.Nombre || navbarUserName?.textContent || '').trim();
          return;
        }
      } catch {}
    }
    // Fallback visual: navbar
    if (!inputNombre.value && navbarUserName?.textContent) {
      inputNombre.value = navbarUserName.textContent.trim();
    }
  }

  // ===== Update (PATCH preferido; fallback PUT) =====
  async function actualizar() {
    setMsg('');
    const v = validarNombre(inputNombre?.value);
    if (!v.ok) { setMsg(v.msg, 'error'); return; }

    const id = await getClienteId();
    if (!id) { setMsg('No se pudo determinar tu Id de cliente.', 'error'); return; }

    // 1) PATCH nombre si está disponible
    try {
      const r = await fetch(PATCH_NOMBRE_BY_ID(id), {
        method: 'PATCH',
        headers: { ...authHeaders(true) },
        credentials: 'include',
        body: JSON.stringify({ nombre: v.nombre })
      });
      if (r.ok) {
        if (navbarUserName) navbarUserName.textContent = v.nombre;
        setMsg('Nombre actualizado correctamente.', 'success');
        return;
      }
      if (r.status !== 404 && r.status !== 405) {
        const t = await r.text().catch(()=> '');
        throw new Error(t || 'No se pudo actualizar el nombre.');
      }
    } catch { /* seguimos a PUT */ }

    // 2) PUT (modelo completo)
    try {
      const getR = await fetch(GET_CLIENTE_BY_ID(id), {
        headers: { Accept:'application/json', ...authHeaders(false) },
        credentials: 'include',
      });
      if (!getR.ok) throw new Error('No se pudo obtener el cliente.');
      const cur = await getR.json();

      const payload = {
        idCliente: cur.idCliente ?? cur.id ?? id,
        nombre: v.nombre,
        correo: cur.correo ?? cur.email ?? '',
        contrasena: cur.contrasena ?? '',
        fechaRegistro: cur.fechaRegistro ?? new Date().toISOString(),
        activo: (typeof cur.activo === 'boolean') ? cur.activo : (cur.activo ?? 1)
      };

      const putR = await fetch(PUT_CLIENTE_BY_ID(id), {
        method: 'PUT',
        headers: { ...authHeaders(true) },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!putR.ok) {
        const t = await putR.text().catch(()=> '');
        throw new Error(t || 'PUT de cliente falló.');
      }

      if (navbarUserName) navbarUserName.textContent = v.nombre;
      setMsg('Nombre actualizado correctamente.', 'success');
    } catch (err) {
      setMsg(err?.message || 'No se pudo actualizar el nombre.', 'error');
    }
  }

  // ===== init =====
  (async function init(){
    await cargarNombre();
    if (btn) btn.addEventListener('click', (e)=>{ e.preventDefault(); actualizar(); });
  })();
})();
