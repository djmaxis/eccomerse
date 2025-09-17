// wwwroot/js/cpanel/cpanelMainBkend.js

// Util: busca una tarjeta (card) por su título visible y devuelve su <tbody>
function findCardTbodyByTitle(titleText) {
  const cards = document.querySelectorAll('.card');
  for (const card of cards) {
    const title = card.querySelector('.card-title');
    if (!title) continue;
    if (title.textContent.trim().toLowerCase() === titleText.trim().toLowerCase()) {
      return card.querySelector('tbody');
    }
  }
  return null;
}

// Util: formateo moneda (USD por defecto)
const fmtMoney = (v, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v || 0);

// 1) Stats
async function loadStats() {
  const res = await fetch('/api/cpanel/main/stats');
  if (!res.ok) throw new Error('No se pudo obtener stats');
  const data = await res.json();

  // Buscamos las 3 tarjetas de métricas en el orden actual del HTML
  const statValues = document.querySelectorAll('.stats .stat-card .stat-value');
  if (statValues.length >= 3) {
    statValues[0].textContent = (data.usuariosRegistrados ?? 0).toString();
    statValues[1].textContent = (data.ordenesPagadasEnviadas ?? 0).toString();
    statValues[2].textContent = (data.ordenesCanceladas ?? 0).toString();
  }
}

// 4) Estatus de órdenes (10 primeros por fecha asc)
// 4) Estatus de órdenes (10 primeros por fecha asc) + % por status
async function loadEstatusOrdenes() {
  const res = await fetch('/api/cpanel/main/estatus-ordenes?take=10');
  if (!res.ok) throw new Error('No se pudo obtener Estatus de órdenes');
  const rows = await res.json();

  const tbody = findCardTbodyByTitle('Estatus de órdenes');
  if (!tbody) return;
  tbody.innerHTML = '';

  const getProgress = (statusRaw) => {
    const s = (statusRaw || '').toString().trim().toLowerCase();
    if (s === 'pagada') return '30%';
    if (s === 'enviada') return '60%';
    if (s === 'completada') return '100%';
    if (s === 'cancelada') return '-';
    return '-';
  };

// Reemplaza badgeClass por badgeStyle
const badgeStyle = (statusRaw) => {
  const s = (statusRaw || '').toString().trim().toLowerCase();

  // aceptamos masculino/femenino para cubrir respuestas del backend
  if (s === 'cancelada' || s === 'cancelado')
    return 'background:#FF5C5C;color:#fff';

  if (s === 'completada' || s === 'completado')
    return 'background:#CFCFCF;color:#111';

  if (s === 'enviada' || s === 'enviado')
    return 'background:#FFDD8A;color:#111';

  if (s === 'pagada' || s === 'pagado')
    return 'background:#B8F2B1;color:#111';

  // default
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

}

// 5) Usuarios Recurrentes (10 primeros asc por Cant Órdenes)
async function loadUsuariosRecurrentes() {
  const res = await fetch('/api/cpanel/main/usuarios-recurrentes?take=10');
  if (!res.ok) throw new Error('No se pudo obtener Usuarios Recurrentes');
  const rows = await res.json();

  const tbody = findCardTbodyByTitle('Usuarios Recurrentes');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const r of rows) {
    const tr = document.createElement('tr');
    const cant = r.CantOrdenes ?? r.cantOrdenes ?? 0;
    const total = r.TotalGastado ?? r.totalGastado ?? 0;

    tr.innerHTML = `
      <td>${r.Usuario || r.usuario || '-'}</td>
      <td>${cant}</td>
      <td>${fmtMoney(total)}</td>
    `;
    tbody.appendChild(tr);
  }
}

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
