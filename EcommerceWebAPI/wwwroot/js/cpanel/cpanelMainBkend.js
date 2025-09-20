// ================= wwwroot/js/cpanel/cpanelMainBkend.js =================
// Reglas:
// - Estatus de órdenes: ordenar DESC por "No. Orden" (ord-YYYY-MM-DD#NNNNNNNN), máx 12, scroll.
// - Usuarios Recurrentes: combo año [2022..2025] (default 2025), filtra por año si es detectable,
//   ordena ASC por Cant Órdenes, máx 18, scroll.
// ========================================================================

// ---------- DOM helpers ----------
function findCardByTitle(titleText) {
  const cards = document.querySelectorAll('.card');
  for (const card of cards) {
    const title = card.querySelector('.card-title');
    if (!title) continue;
    if (title.textContent.trim().toLowerCase() === titleText.trim().toLowerCase()) {
      return card;
    }
  }
  return null;
}
function findCardTbodyByTitle(titleText) {
  const card = findCardByTitle(titleText);
  return card ? card.querySelector('tbody') : null;
}
function ensureScroll(container, maxPx) {
  if (!container) return;
  container.style.maxHeight = `${maxPx}px`;
  container.style.overflowY = 'auto';
}

// ---------- Utilidades ----------
const fmtMoney = (v, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v || 0));

function parseFechaAny(s) {
  if (!s) return null;
  const str = String(s).trim();

  // dd/MM/yyyy
  const m1 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) {
    const dd = +m1[1], mm = +m1[2] - 1, yy = +m1[3];
    const dt = new Date(yy, mm, dd);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // ISO / Date()
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt;
}

// Para ordenar por “No. Orden”: ord-YYYY-MM-DD#00000001
function parseNoOrdenMask(mask) {
  const s = String(mask || '');
  const m = s.match(/ord-(\d{4})-(\d{2})-(\d{2})#(\d{8})/i);
  if (m) {
    const yy = +m[1], mm = +m[2] - 1, dd = +m[3];
    const serial = +m[4];
    const dt = new Date(yy, mm, dd);
    const ts = isNaN(dt.getTime()) ? -Infinity : dt.getTime();
    return { ts, serial };
  }
  // fallback: intenta extraer fecha ISO simple
  const mx = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  const dt = mx ? new Date(+mx[1], +mx[2] - 1, +mx[3]) : parseFechaAny(s);
  return { ts: dt ? dt.getTime() : -Infinity, serial: -Infinity };
}

function getYearFromRow(r) {
  // campos de año directos
  const y = r.Anio ?? r.anio ?? r.Year ?? r.year;
  if (y !== undefined && y !== null && y !== '') {
    const yn = Number(y);
    return Number.isFinite(yn) ? yn : NaN;
  }

  // fechas comunes
  const f = r.FechaUltimaOrden ?? r.UltimaCompra ?? r.Fecha ?? r.fecha ?? r.Fec ?? r.fec ?? r.Date ?? r.date;
  const dt = f ? new Date(String(f)) : null;
  if (dt && !isNaN(dt.getTime())) return dt.getFullYear();

  // máscara tipo ord-YYYY-MM-DD#...
  const mask = r.NoOrden ?? r.noOrden ?? r.Mask ?? r.mask ?? '';
  const m = String(mask).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Number(m[1]);

  return NaN;
}

// --- Crea el combo una sola vez y respeta la selección actual ---
function ensureYearCombo() {
  const card = findCardByTitle('Usuarios Recurrentes');
  if (!card) return null;

  let sel = card.querySelector('select[data-role="year-filter"]');
  if (sel) return sel; // ya existe, no tocar su valor

  const title = card.querySelector('.card-title');
  sel = document.createElement('select');
  sel.setAttribute('data-role', 'year-filter');
  sel.style.marginLeft = '8px';
  sel.style.padding = '4px 8px';
  sel.style.border = '1px solid #e2e8f0';
  sel.style.borderRadius = '6px';

  [2022, 2023, 2024, 2025].forEach(y => {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    sel.appendChild(opt);
  });

  // solo al CREAR por primera vez ponemos 2025
  sel.value = '2025';

  title.insertAdjacentElement('afterend', sel);
  return sel;
}
// ========================================================================
// 1) Stats (sin cambios funcionales)
async function loadStats() {
  const res = await fetch('/api/cpanel/main/stats');
  if (!res.ok) throw new Error('No se pudo obtener stats');
  const data = await res.json();

  const statValues = document.querySelectorAll('.stats .stat-card .stat-value');
  if (statValues.length >= 3) {
    statValues[0].textContent = (data.usuariosRegistrados ?? 0).toString();
    statValues[1].textContent = (data.ordenesPagadasEnviadas ?? 0).toString();
    statValues[2].textContent = (data.ordenesCanceladas ?? 0).toString();
  }
}

// ========================================================================
// 2) Estatus de órdenes → DESC por "No. Orden", máx 12, scroll
async function loadEstatusOrdenes() {
  // pedimos bastante y luego ordenamos/recortamos nosotros
  const res = await fetch('/api/cpanel/main/estatus-ordenes?take=100');
  if (!res.ok) throw new Error('No se pudo obtener Estatus de órdenes');
  let rows = await res.json();

  // Orden DESC por No. Orden (fecha dentro de la máscara + serial)
  rows = rows
    .map(r => {
      const noOrden = r.NoOrden ?? r.noOrden ?? '';
      const parsed = parseNoOrdenMask(noOrden);
      return { ...r, __ts: parsed.ts, __serial: parsed.serial };
    })
    .sort((a, b) => {
      if (b.__ts !== a.__ts) return b.__ts - a.__ts;       // primero por fecha DESC
      return (b.__serial || 0) - (a.__serial || 0);        // luego por serial DESC
    })
    .slice(0, 12);

  const card = findCardByTitle('Estatus de órdenes');
  const tbody = card ? card.querySelector('tbody') : null;
  if (!tbody) return;
  tbody.innerHTML = '';

  const getProgress = (statusRaw) => {
    const s = (statusRaw || '').toString().trim().toLowerCase();
    if (s === 'pagada' || s === 'pagado') return '30%';
    if (s === 'enviada' || s === 'enviado') return '60%';
    if (s === 'completada' || s === 'completado') return '100%';
    if (s === 'cancelada' || s === 'cancelado') return '-';
    return '-';
  };

  const badgeStyle = (statusRaw) => {
    const s = (statusRaw || '').toString().trim().toLowerCase();
    if (s === 'cancelada' || s === 'cancelado')   return 'background:#FF5C5C;color:#fff';
    if (s === 'completada' || s === 'completado') return 'background:#CFCFCF;color:#111';
    if (s === 'enviada' || s === 'enviado')       return 'background:#FFDD8A;color:#111';
    if (s === 'pagada' || s === 'pagado')         return 'background:#B8F2B1;color:#111';
    return 'background:#CFCFCF;color:#111';
  };

  for (const r of rows) {
    const noOrden = r.NoOrden || r.noOrden || '-';
    const cliente = r.Cliente || r.cliente || '-';
    const fecha   = r.Fecha   || r.fecha   || '-';
    const status  = r.Estatus || r.estatus || '-';
    const prog    = getProgress(status);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${noOrden}</td>
      <td>${cliente}</td>
      <td>${fecha}</td>
      <td><span class="badge" style="${badgeStyle(status)}">${status}</span></td>
      <td><span class="tag">${prog}</span></td>
    `;
    tbody.appendChild(tr);
  }

  // Scroll en la card
  const wrap = card?.querySelector('.table-wrap');
  ensureScroll(wrap, 360);
}

// ========================================================================
// 3) Usuarios Recurrentes → combo año + filtro si hay año + ASC Cant Órdenes + máx 18 + scroll
function ensureYearCombo() {
  const card = findCardByTitle('Usuarios Recurrentes');
  if (!card) return null;

  // ¿ya existe?
  let sel = card.querySelector('select[data-role="year-filter"]');
  if (sel) return sel;

  // crear junto al título
  const title = card.querySelector('.card-title');
  sel = document.createElement('select');
  sel.setAttribute('data-role', 'year-filter');
  sel.style.marginLeft = '8px';
  sel.style.padding = '4px 8px';
  sel.style.border = '1px solid #e2e8f0';
  sel.style.borderRadius = '6px';

  [2022, 2023, 2024, 2025].forEach(y => {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    sel.appendChild(opt);
  });
  sel.value = '2025';
  title.insertAdjacentElement('afterend', sel);
  return sel;
}

async function loadUsuariosRecurrentes() {
  const sel = ensureYearCombo();
  const year = Number(sel?.value || 2025);

  // Pedimos lo suficiente; si el backend ya filtra por ?year, mejor.
  const res = await fetch(`/api/cpanel/main/usuarios-recurrentes?take=200&year=${year}`);
  if (!res.ok) throw new Error('No se pudo obtener Usuarios Recurrentes');
  let rows = await res.json();

  // 1) Detectar si HAY año en los datos. Si ninguno tiene año, NO filtramos (evitamos quedarnos vacíos).
  const rowsWithYear = rows.map(r => ({ r, y: getYearFromRow(r) })).filter(x => Number.isFinite(x.y));
  if (rowsWithYear.length > 0) {
    rows = rowsWithYear.filter(x => x.y === year).map(x => x.r);
  } // else: sin año detectable, mostramos todo

  // 2) Orden ASC por Cant Órdenes (aceptamos variantes de nombre)
  rows.sort((a, b) => {
    const ca = Number(a.CantOrdenes ?? a.cantOrdenes ?? a.Ordenes ?? a.ordenes ?? 0);
    const cb = Number(b.CantOrdenes ?? b.cantOrdenes ?? b.Ordenes ?? b.ordenes ?? 0);
    return ca - cb;
  });

  // 3) Máx 18
  rows = rows.slice(0, 18);

  // 4) Render
  const card  = findCardByTitle('Usuarios Recurrentes');
  const tbody = card ? card.querySelector('tbody') : null;
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const r of rows) {
    const usuario = r.Usuario ?? r.usuario ?? r.Email ?? r.email ?? '-';
    const cant  = Number(r.CantOrdenes ?? r.cantOrdenes ?? r.Ordenes ?? r.ordenes ?? 0);
    const total = Number(r.TotalGastado ?? r.totalGastado ?? r.Total ?? r.total ?? 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${usuario}</td>
      <td>${cant}</td>
      <td>${fmtMoney(total)}</td>
    `;
    tbody.appendChild(tr);
  }

  // 5) Scroll
  const wrap = card?.querySelector('.table-wrap');
  ensureScroll(wrap, 360);

  // 6) Re-enganchamos el change del combo una sola vez
  if (sel && !sel.__bound) {
    sel.addEventListener('change', () => { loadUsuariosRecurrentes().catch(console.error); });
    sel.__bound = true;
  }
}

// ========================================================================
// Boot
async function boot() {
  try {
    await Promise.all([
      loadStats(),
      loadEstatusOrdenes(),
      loadUsuariosRecurrentes()
    ]);
  } catch (err) {
    console.error('[cpanelMain] Error al cargar cpanel:', err);
  }
}
document.addEventListener('DOMContentLoaded', boot);
