// cpanelOrdenesFiltros.js
(() => {
  // ==== Utilidades de fecha ====
  const firstDayOfCurrentMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };
  const lastDayOfCurrentMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  };
  const yyyy_mm_dd = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // ==== Elementos UI ====
  const fini = document.getElementById('fini');
  const ffin = document.getElementById('ffin');
  const festGroup = document.getElementById('festGroup');
  const fcli = document.getElementById('fcli');
  const ford = document.getElementById('ford');

  // ==== Lectura de filtros actuales ====
  function currentFilters() {
    const selectedEstatus = [];
    if (festGroup) {
      festGroup.querySelectorAll('input[name="fest"]:checked').forEach(cb => {
        selectedEstatus.push(cb.value);
      });
    }
    return {
      fechaini: fini?.value || '',
      fechafin: ffin?.value || '',
      estatus:  selectedEstatus,     // ← ahora es ARRAY
      cliente:  fcli?.value?.trim() || '',
      no:       ford?.value?.trim() || ''
    };
  }

  // ==== Defaults (mes actual + todas las casillas marcadas) ====
  function setDefaults() {
    if (fini && ffin) {
      fini.value = yyyy_mm_dd(firstDayOfCurrentMonth());
      ffin.value = yyyy_mm_dd(lastDayOfCurrentMonth());
    }
    if (festGroup) {
      festGroup.querySelectorAll('input[name="fest"]').forEach(cb => {
        cb.checked = true; // ← todas check por defecto
      });
    }
    if (fcli) fcli.value = '';
    if (ford) ford.value = '';
  }

  // ==== Listeners ====
  document.getElementById('btnFiltrar')?.addEventListener('click', () => {
    window.applyOrdenesFilters?.(currentFilters());
  });

  document.getElementById('btnLimpiar')?.addEventListener('click', () => {
    setDefaults();
    window.applyOrdenesFilters?.(currentFilters());
  });

  // Si quieres auto-filtrar cuando el usuario tilda/destilda, descomenta:
  // festGroup?.addEventListener('change', () => {
  //   window.applyOrdenesFilters?.(currentFilters());
  // });

  // ==== Arranque ====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setDefaults();
      window.applyOrdenesFilters?.(currentFilters());
    });
  } else {
    setDefaults();
    window.applyOrdenesFilters?.(currentFilters());
  }
})();
