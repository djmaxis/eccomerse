// js/mi_perfil/menu.js
(function () {
  const STORAGE_KEY = 'profileSidebarOpenGroups';
  const SIDEBAR_COLLAPSED = 'profileSidebarCollapsed';
  const DEFAULT_START_COLLAPSED = true; // arranca colapsado

  const sidebar = document.getElementById('profile-sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse');
  const openBtn = document.getElementById('open-sidebar-btn');
  const overlay = document.getElementById('sidebar-overlay');

  if (!sidebar) return;

  const isMobile = () => window.innerWidth <= 992;
  const isDrawerOpen = () => sidebar.classList.contains('drawer-open');

  function openDrawer() {
    sidebar.classList.add('drawer-open');
    if (overlay) overlay.hidden = false;
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    sidebar.classList.remove('drawer-open');
    if (overlay) overlay.hidden = true;
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
  }

  // ===== Acordeones con persistencia =====
  const saved = localStorage.getItem(STORAGE_KEY);
  const groupsState = new Set(saved ? JSON.parse(saved) : []);

document.querySelectorAll('.sidebar-toggle').forEach((btn) => {
  const targetId = btn.getAttribute('data-target');
  const listEl = document.getElementById(targetId);
  const isOpen = saved ? groupsState.has(targetId) : !DEFAULT_START_COLLAPSED;

  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

  // ✅ FIX: sincroniza la visibilidad inicial con el estado guardado
  if (listEl) {
    if (isOpen) listEl.removeAttribute('hidden');
    else listEl.setAttribute('hidden', '');
  }

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const next = !expanded;
    btn.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      listEl?.removeAttribute('hidden');
      groupsState.add(targetId);
    } else {
      listEl?.setAttribute('hidden', '');
      groupsState.delete(targetId);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groupsState]));
  });
});

  // ===== Colapso visual general (mantiene estado por grupo) =====
  if (collapseBtn) {
    const initialCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED) === '1';
    if (initialCollapsed) sidebar.classList.add('collapsed');
    collapseBtn.setAttribute('aria-expanded', initialCollapsed ? 'false' : 'true');

    collapseBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      collapseBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      localStorage.setItem(SIDEBAR_COLLAPSED, isCollapsed ? '1' : '0');
    });
  }

  // ===== Abrir / cerrar drawer =====
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (isDrawerOpen()) closeDrawer(); else openDrawer();
    });
  }
  if (overlay) {
    overlay.addEventListener('click', closeDrawer);
  }

  // Cerrar tras click en cualquier enlace del sidebar (en móvil)
  document.querySelectorAll('#profile-sidebar a').forEach(a => {
    a.addEventListener('click', () => {
      if (isMobile() && isDrawerOpen()) closeDrawer();
    });
  });

  // ===== NUEVO: Cerrar con clic fuera (pointerdown), Escape y focus/tab fuera =====

  // 1) Clic fuera (capturando) – cubre mouse y touch
  const outsidePointerHandler = (e) => {
    if (!isMobile() || !isDrawerOpen()) return;
    const insideSidebar = sidebar.contains(e.target);
    const onOpenBtn = openBtn && openBtn.contains(e.target);
    if (!insideSidebar && !onOpenBtn) {
      closeDrawer();
    }
  };
  // usar capture para adelantarnos a handlers que hagan stopPropagation
  document.addEventListener('pointerdown', outsidePointerHandler, true);
  // fallback para entornos sin pointer events
  document.addEventListener('mousedown', outsidePointerHandler, true);
  document.addEventListener('touchstart', outsidePointerHandler, true);

  // 2) Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMobile() && isDrawerOpen()) {
      closeDrawer();
    }
  });

  // 3) Focus/Tab fuera (cuando el foco va a un elemento que no está en el sidebar)
  document.addEventListener('focusin', (e) => {
    if (!isMobile() || !isDrawerOpen()) return;
    const insideSidebar = sidebar.contains(e.target);
    const onOpenBtn = openBtn && openBtn.contains(e.target);
    if (!insideSidebar && !onOpenBtn) {
      closeDrawer();
    }
  });

  // ===== Cerrar si cambias de tamaño (de móvil a desktop) =====
  window.addEventListener('resize', () => {
    if (!isMobile() && isDrawerOpen()) {
      closeDrawer();
    }
  });
})();
