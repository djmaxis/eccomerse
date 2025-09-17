// wwwroot/js/cpanel/cpanel.js  (versión con console.log y sin $)
(() => {
  // ===== Log helpers =====
  const LOG  = (...a) => console.log('%c[cpanel]', 'color:#2563eb;font-weight:bold', ...a);
  const WARN = (...a) => console.warn('%c[cpanel]', 'color:#d97706;font-weight:bold', ...a);
  const ERR  = (...a) => console.error('%c[cpanel]', 'color:#ef4444;font-weight:bold', ...a);

  // ===== DOM helpers (no jQuery) =====
  const qs  = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];
  const el  = (tag, cls = '') => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };

  // Errores globales (para detectar cualquier caída)
  window.addEventListener('error', e => ERR('window.error', e.error || e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', e => ERR('unhandledrejection', e.reason));

  // ===== Estado y datos de ejemplo (si no existen) =====
  const state = (window.__CPANEL_STATE__ = window.__CPANEL_STATE__ || { activeMenu: 'dashboard', isCartOpen: false });

  const menuItems = window.menuItems || [
    { id: 'dashboard',     label: 'Dashboard',              icon: '📊' },
    { id: 'products',      label: 'Productos',              icon: '📦' },
    { id: 'orders',        label: 'Órdenes',                icon: '📋' },
    { id: 'invoices',      label: 'Facturas',               icon: '📄' },
    { id: 'shipping',      label: 'Shipping',               icon: '🚚' },
    { id: 'analytics',     label: 'Gráficas',               icon: '📈' },
    { id: 'notifications', label: 'Centro Notificaciones',  icon: '🔔' },
    { id: 'settings',      label: 'Ajustes',                icon: '⚙️' },
  ];

  const stats = window.stats || [
    { title: 'Usuarios registrados', value: '83',  color: '#22c55e',  icon: '📋', description: 'Usuarios activos en el sistema' },
    { title: 'Órdenes Pagadas / Enviadas', value: '135', color: '#ee8e4a', icon: '📦', description: 'Órdenes completadas' },
    { title: 'Órdenes Canceladas', value: '23', color: '#f06a55', icon: '❌', description: 'Órdenes canceladas por usuarios' }
  ];

  const orderStatusData = window.orderStatusData || [
    { orderId: 'ord-2025-09-15#00000001', client: 'usuario@correo.com', date: '28/02/2025', status: 'Cancelada', progress: '-' }
  ];

  const recurringUsers = window.recurringUsers || [
    { email: 'usuario@correo.com', orderCount: 5, totalSpent: '$15,000' }
  ];

  // Si tuvieras una función global, la usamos; si no, definimos una simple
  const setActiveMenu = window.setActiveMenu || function(id){
    LOG('setActiveMenu:', id);
    state.activeMenu = id;
    renderTitle();
  };

  // ===== Render: Menú =====
  function renderMenu() {
    LOG('renderMenu:start');
    const ul = qs('#menuList');
    if (!ul) { WARN('renderMenu: #menuList NO existe en esta página'); return; }
    ul.innerHTML = '';
    menuItems.forEach(item => {
      const li = el('li');
      const btn = el(
        'button',
        `sidebar-item w-full flex items-center px-4 py-3 rounded-lg ${
          state.activeMenu === item.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`
      );
      btn.dataset.menu = item.id;
      btn.innerHTML = `<span class="mr-3">${item.icon}</span><span>${item.label}</span>`;
      btn.addEventListener('click', () => setActiveMenu(item.id));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    LOG('renderMenu:done');
  }

  // ===== Render: Título =====
  function renderTitle() {
    LOG('renderTitle:start');
    const h = qs('#pageTitle');
    if (!h) { WARN('renderTitle: #pageTitle NO existe en esta página'); return; }
    const m = menuItems.find(x => x.id === state.activeMenu);
    h.textContent = m ? m.label : 'Dashboard';
    LOG('renderTitle:done ->', h.textContent);
  }

  // ===== Render: Stats =====
  function renderStats() {
    LOG('renderStats:start');
    const grid = qs('#statsGrid');
    if (!grid) { WARN('renderStats: #statsGrid NO existe en esta página'); return; }
    grid.innerHTML = '';
    stats.forEach(s => {
      const card = el('div', 'stat-card p-6 rounded-lg shadow-md text-white');
      card.style.backgroundColor = s.color;
      card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold">${s.title}</h3>
          <div class="text-2xl">${s.icon}</div>
        </div>
        <div class="text-3xl font-bold">${s.value}</div>
        <p class="text-white/90 text-sm mt-1">${s.description}</p>
      `;
      grid.appendChild(card);
    });
    LOG('renderStats:done');
  }

  // ===== Render: Órdenes =====
  function renderOrders() {
    LOG('renderOrders:start');
    const tbody = qs('#ordersTbody');
    if (!tbody) { WARN('renderOrders: #ordersTbody NO existe en esta página'); return; }
    tbody.innerHTML = '';
    orderStatusData.forEach(o => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-gray-200 last:border-b-0';
      const stClass = o.status === 'Cancelada' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
      tr.innerHTML = `
        <td class="py-3">${o.orderId}</td>
        <td class="py-3">${o.client || ''}</td>
        <td class="py-3">${o.date}</td>
        <td class="py-3"><span class="px-2 py-1 rounded text-xs font-medium ${stClass}">${o.status}</span></td>
        <td class="py-3"><span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">${o.progress}</span></td>
      `;
      tbody.appendChild(tr);
    });
    LOG('renderOrders:done');
  }

  // ===== Render: Usuarios =====
  function renderUsers() {
    LOG('renderUsers:start');
    const tbody = qs('#usersTbody');
    if (!tbody) { WARN('renderUsers: #usersTbody NO existe en esta página'); return; }
    tbody.innerHTML = '';
    recurringUsers.forEach(u => {
      const tr = el('tr', 'border-b border-gray-200 last:border-b-0');
      tr.innerHTML = `
        <td class="py-3">${u.email}</td>
        <td class="py-3">${u.orderCount}</td>
        <td class="py-3">${u.totalSpent}</td>
      `;
      tbody.appendChild(tr);
    });
    LOG('renderUsers:done');
  }

  // ===== Usuario (etiqueta arriba a la derecha) =====
  function setUserLabel() {
    LOG('setUserLabel:start');
    const n = qs('#userLabel');
    if (!n) { WARN('setUserLabel: #userLabel NO existe en esta página'); return; }
    const nombre = localStorage.getItem('nombre') || localStorage.getItem('correo') || 'Usuario';
    n.textContent = nombre;
    LOG('setUserLabel:done ->', nombre);
  }

  // ===== Logout =====
  function setupLogout() {
    LOG('setupLogout:start');
    const btn = qs('#btnLogout');
    if (!btn) { WARN('setupLogout: #btnLogout NO existe en esta página'); return; }
    LOG('setupLogout: botón encontrado', btn);

    btn.addEventListener('click', (e) => {
      LOG('logout:click');
      e.preventDefault();
      try {
        localStorage.clear();
        sessionStorage.clear();
        LOG('logout:storage cleared');
      } catch (err) {
        WARN('logout:storage clear failed', err);
      }
      const target = 'index.html?logout=' + Date.now();
      LOG('logout:navigate ->', target);
      if (typeof window.location.replace === 'function') {
        window.location.replace(target);
      } else {
        window.location.href = target;
      }
    });
    LOG('setupLogout:listener enganchado');
  }

  // ===== Init =====
  function init() {
    LOG('init:DOMContentLoaded');
    // Qué scripts están cargados
    const scripts = [...document.scripts].map(s => s.src || s.id || (s.textContent?.slice(0, 40) + '...'));
    LOG('init:scripts', scripts);
    // Qué nodos existen en esta página
    LOG('init:elements', {
      menuList:   !!qs('#menuList'),
      pageTitle:  !!qs('#pageTitle'),
      statsGrid:  !!qs('#statsGrid'),
      ordersTbody:!!qs('#ordersTbody'),
      usersTbody: !!qs('#usersTbody'),
      userLabel:  !!qs('#userLabel'),
      btnLogout:  !!qs('#btnLogout'),
    });

    try { renderMenu(); }   catch (e) { ERR('renderMenu:error', e); }
    try { renderTitle(); }  catch (e) { ERR('renderTitle:error', e); }
    try { renderStats(); }  catch (e) { ERR('renderStats:error', e); }
    try { renderOrders(); } catch (e) { ERR('renderOrders:error', e); }
    try { renderUsers(); }  catch (e) { ERR('renderUsers:error', e); }
    try { setUserLabel(); } catch (e) { ERR('setUserLabel:error', e); }
    try { setupLogout(); }  catch (e) { ERR('setupLogout:error', e); }

    LOG('init:done');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
