import { apiUrl, formatNumber, normalizeProduct, isLoggedIn } from './utils.js';
import { 
  addItemToGuestCart, 
  renderCartFromStorage, 
  apiUpsertCartFrom, 
  hydrateLocalFromBD 
} from './cart.js';

let PRODUCTS_CACHE = [];
let _els = { productsGrid: null, searchInput: null, stockOnlySwitch: null };

export async function fetchProductsLowStock() {
  const url = apiUrl('/api/productos?activo=1');
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  const payload = await res.json();
  return Array.isArray(payload) ? payload : (payload?.items ?? []);
}

function makeProductCard(p) {
  const name = p.name ?? p.Nombre ?? '';
  const ref  = p.ref  ?? p.RefModelo ?? p.IdProducto ?? '';
  const price = Number(p.price ?? p.Precio ?? 0);
  const stock = Number(p.stock ?? p.Stock ?? 0);
  const imgSrc = p.image ?? p.Image ?? 'img/placeholder.jpg';
  const description = p.description ?? p.Descripcion ?? '';

  const div = document.createElement('div');
  div.className = 'product-card';
  div.dataset.productId = ref;

  div.innerHTML = `
    <div class="product-media" style="position:relative;">
      <img src="${imgSrc}" alt="${name}" class="product-image" />
    </div>
    <div class="product-info">
      <h3 class="product-name">${name}</h3>
      <p class="product-ref">Ref: ${ref}</p>
      <p class="product-price">$${formatNumber(price, 2)}</p>
      <p class="product-description">${description}</p>
      <button class="add-to-cart-btn">
        <i class="fas fa-plus"></i> Agregar al carrito
      </button>
    </div>
  `;

  const media = div.querySelector('.product-media');
  const btn = div.querySelector('.add-to-cart-btn');

  // Overlays de stock
  if (stock <= 0) {
    btn.classList.add('disabled');
    btn.disabled = true;
    const overlaySold = document.createElement('div');
    overlaySold.textContent = 'Sold Out';
    Object.assign(overlaySold.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      padding: '6px 10px', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.6)',
      color: '#fff', borderRadius: '8px', zIndex: '2', pointerEvents: 'none'
    });
    media.appendChild(overlaySold);
  } else if (stock === 1) {
    const overlayLow = document.createElement('div');
    overlayLow.textContent = '¡Último!';
    Object.assign(overlayLow.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      padding: '8px 14px', textAlign: 'center',
      backgroundColor: 'rgba(255,165,0,0.4)',
      color: '#fff', border: '1px solid rgba(255,165,0,0.7)',
      borderRadius: '10px', fontWeight: '600', zIndex: '2', pointerEvents: 'none'
    });
    media.appendChild(overlayLow);
  }

  // Evento Agregar al carrito
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;

    const item = {
      id: String(ref),
      name,
      price,
      img: imgSrc,
      qty: 1,
      stock
    };

    if (isLoggedIn()) {
      // Usuario logueado → POST directo a BD
      const up = await apiUpsertCartFrom([item]);
      if (up.ok) {
        hydrateLocalFromBD(up.data); // Refresca carrito local y UI desde BD
      } else {
        console.warn('[ADD] Falló POST en BD:', up.status, up.data);
      }
    } else {
      // Invitado → LocalStorage
      addItemToGuestCart(item);
      renderCartFromStorage();
    }

    // Feedback visual
    btn.innerHTML = '<i class="fas fa-check"></i> Agregado!';
    btn.style.backgroundColor = '#20c997';
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-plus"></i> Agregar al carrito';
      btn.style.backgroundColor = '#0d6efd';
    }, 1200);
  });

  return div;
}

export function renderProducts(list) {
  const { productsGrid } = _els;
  if (!productsGrid) {
    console.debug('[products] renderProducts(): no productsGrid — skip');
    return;
  }
  productsGrid.innerHTML = '';
  if (!list.length) {
    productsGrid.innerHTML = `<p style="text-align:center;color:#6c757d">No hay productos disponibles.</p>`;
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(p => frag.appendChild(makeProductCard(p)));
  productsGrid.appendChild(frag);
}

export function applyFilters() {
  const { searchInput, stockOnlySwitch } = _els;
  const term = (searchInput?.value || '').toLowerCase();
  const showOnlyInStock = !!stockOnlySwitch?.checked;

  const filtered = PRODUCTS_CACHE.filter(p => {
    const name = (p.name ?? p.Nombre ?? '').toLowerCase();
    const ref  = String(p.ref ?? p.RefModelo ?? p.IdProducto ?? '').toLowerCase();

    const matchesText = !term || name.includes(term) || ref.includes(term);
    const inStockOK   = showOnlyInStock ? (Number(p.stock ?? p.Stock ?? 0) > 0) : true;

    return matchesText && inStockOK;
  });

  renderProducts(filtered);
}

export async function initProducts({ productsGrid, searchInput, stockOnlySwitch }) {
  _els = { productsGrid, searchInput, stockOnlySwitch };
  try {
    const arr = await fetchProductsLowStock();
    PRODUCTS_CACHE = (arr || []).map(normalizeProduct).filter(p => p.activo === 1);

    if (stockOnlySwitch) stockOnlySwitch.checked = true;
    applyFilters();

    searchInput?.addEventListener('input', applyFilters);
    stockOnlySwitch?.addEventListener('change', applyFilters);
  } catch (err) {
    console.error(err);
    productsGrid.innerHTML = `<p style="text-align:center;color:#dc3545">No se pudieron cargar los productos.</p>`;
  }
}
