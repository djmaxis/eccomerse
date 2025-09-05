/***********************
 *  CONFIGURACIÓN API  *
 ***********************/
const API_BASE = ""; 
// 👉 Si usas proxy en Vite, déjalo vacío y llama rutas como "/api/..."
// 👉 Si NO usas proxy, coloca aquí la URL base de tu API (ej: "https://localhost:7044")
function apiUrl(path) { return API_BASE ? `${API_BASE}${path}` : path; }

/***********************
 *  AUTH & UTILIDADES  *
 ***********************/
function hasToken() { return !!localStorage.getItem('token'); }
function getToken() { return localStorage.getItem('token'); }
function getNombre() { return localStorage.getItem('nombre') || ''; }
function getCorreo() { return localStorage.getItem('correo') || ''; }
function getIniciales(nombre) {
  if (!nombre) return 'US';
  const parts = nombre.trim().split(/\s+/).slice(0,2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'US';
}
function isLoggedIn() { return hasToken(); }
function formatNumber(number, decimals = 0) {
  return Number(number).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Normaliza claves del backend a un formato consistente para el frontend
function normalizeProduct(p) {
  const nombre = p.Nombre ?? p.nombre ?? p.Name ?? p.name ?? '';
  const descripcion = p.Descripcion ?? p.descripcion ?? p.description ?? '';
  const precio = Number(p.Precio ?? p.precio ?? p.Price ?? p.price ?? 0);
  const stock = Number(p.Stock ?? p.stock ?? 0);
  const activoRaw = p.Activo ?? p.activo;
  const activo = Number(
    activoRaw === true ? 1 :
    activoRaw === false ? 0 :
    activoRaw ?? 0
  );
  const ref = p.RefModelo ?? p.refModelo ?? p.refmodelo ?? p.Ref ?? p.ref ?? p.IdProducto ?? p.id ?? '';
  const image = p.image ?? p.Image ?? p.imagen ?? p.urlImagen ?? 'img/placeholder.jpg';
  const id = Number(p.IdProducto ?? p.id ?? 0);

  return { id, ref, name: nombre, description: descripcion, price: precio, stock, activo, image };
}


/***********************
 *  REFERENCIAS DOM    *
 ***********************/
const cartBtn = document.getElementById('cart-btn');
const closeCart = document.getElementById('close-cart');
const cartModal = document.getElementById('cart-modal');
const overlay = document.getElementById('overlay');
const cartCount = document.querySelector('.cart-count');
const cartItemsContainer = document.querySelector('.cart-items');
const totalEl = document.getElementById('total-amount');

const userAuthenticated = document.getElementById('user-authenticated');
const userUnauthenticated = document.getElementById('user-unauthenticated');
const authLinks = document.querySelectorAll('.nav-links a[data-auth="true"]');
const logoutBtn = document.getElementById('btnLogout');
const loginBtn = document.getElementById('btnLogin');
const registerBtn = document.getElementById('btnRegister');
const loginBtn2 = document.getElementById('btnLogin2');
const registerBtn2 = document.getElementById('btnRegister2');

const productsGrid = document.getElementById('products-grid');
const searchInput = document.getElementById("product-search");
const stockOnlySwitch = document.getElementById("stock-only");

/*******************************************
 *  CARRITO (persistencia local invitado)  *
 *******************************************/
const GUEST_CART_KEY = 'guestCart'; // { items: [{id, name, price, img, qty, stock}] }

function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.items) ? parsed : { items: [] };
  } catch { return { items: [] }; }
}
function writeGuestCart(cart) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart || { items: [] }));
}
function addItemToGuestCart(item) {
  const cart = readGuestCart();
  const existing = cart.items.find(x => x.id === item.id);
  if (existing) existing.qty += item.qty;
  else cart.items.push(item);
  writeGuestCart(cart);
}
function removeItemFromGuestCart(id) {
  const cart = readGuestCart();
  cart.items = cart.items.filter(x => x.id !== id);
  writeGuestCart(cart);
}
function updateQtyGuestCart(id, qty) {
  const cart = readGuestCart();
  const it = cart.items.find(x => x.id === id);
  if (it) { it.qty = Math.max(1, qty || 1); writeGuestCart(cart); }
}

/********************************
 *  RENDER CARRITO Y TOTALES    *
 ********************************/
function renderCartFromStorage() {
  const cart = readGuestCart();
  cartItemsContainer.innerHTML = '';
  if (!cart.items.length) {
    cartItemsContainer.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
    if (cartCount) cartCount.textContent = '0';
    updateCartTotals();
    return;
  }

  let count = 0;
  cart.items.forEach(it => {
    count += it.qty;

    const cartItem = document.createElement('div');
    cartItem.classList.add('cart-item');
    cartItem.dataset.productId = it.id;
    cartItem.innerHTML = `
      <img src="${it.img}" alt="${it.name}" class="cart-item-image">
      <div class="cart-item-info">
          <h4 class="cart-item-name">${it.name}</h4>
          <p class="cart-item-id">ID: ${it.id}</p>
          <p class="cart-item-price">$${formatNumber(it.price)}</p>
          <p class="cart-item-stock">Stock: ${it.stock}</p>
          <div class="cart-item-controls">
              <button class="quantity-btn minus">-</button>
              <input type="number" class="cart-item-quantity" value="${it.qty}" min="1">
              <button class="quantity-btn plus">+</button>
              <button class="remove-item">Eliminar</button>
          </div>
      </div>
    `;
    cartItemsContainer.appendChild(cartItem);

    // eventos
    cartItem.querySelector('.quantity-btn.minus').addEventListener('click', function () {
      const input = this.nextElementSibling;
      let q = parseInt(input.value) || 1;
      if (q > 1) q--; else return;
      input.value = q;
      updateQtyGuestCart(it.id, q);
      updateCartTotals();
      syncCounter();
    });

    cartItem.querySelector('.quantity-btn.plus').addEventListener('click', function () {
      const input = this.previousElementSibling;
      let q = (parseInt(input.value) || 1) + 1;
      input.value = q;
      updateQtyGuestCart(it.id, q);
      updateCartTotals();
      syncCounter();
    });

    cartItem.querySelector('.cart-item-quantity').addEventListener('input', function () {
      let q = parseInt(this.value);
      if (isNaN(q) || q < 1) { q = 1; this.value = 1; }
      updateQtyGuestCart(it.id, q);
      updateCartTotals();
      syncCounter();
    });

    cartItem.querySelector('.remove-item').addEventListener('click', function () {
      cartItem.remove();
      removeItemFromGuestCart(it.id);
      if (!readGuestCart().items.length) {
        cartItemsContainer.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
      }
      updateCartTotals();
      syncCounter();
    });
  });

  if (cartCount) cartCount.textContent = String(count);
  updateCartTotals();
}
function syncCounter() {
  const cart = readGuestCart();
  const count = cart.items.reduce((a,b)=>a+(b.qty||1),0);
  if (cartCount) cartCount.textContent = String(count);
}
function updateCartTotals() {
  const cart = readGuestCart();
  const total = cart.items.reduce((sum, it) => {
    const price = Number(it.price) || 0;
    const qty = Number(it.qty) || 1;
    return sum + price * qty;
  }, 0);
  if (totalEl) totalEl.textContent = `$${formatNumber(total, 2)}`;
}

/********************************
 *  HEADER: SESIÓN / NAVBAR     *
 ********************************/
function ensureSessionDecorations() {
  const avatar = userAuthenticated?.querySelector('.user-avatar'); // si agregas avatar luego
  const nameSpan = document.getElementById('user-name') || userAuthenticated?.querySelector('.user-info span');
  if (isLoggedIn()) {
    const nombre = getNombre();
    const correo = getCorreo();
    if (avatar) avatar.textContent = getIniciales(nombre);
    if (nameSpan) nameSpan.textContent = nombre || correo || 'Usuario';
  }
}
function toggleNavbar() {
  const logged = isLoggedIn();
  if (userAuthenticated) userAuthenticated.style.display = logged ? 'flex' : 'none';
  if (userUnauthenticated) userUnauthenticated.style.display = logged ? 'none' : 'flex';
  authLinks.forEach(a => a.style.display = logged ? 'inline-block' : 'none');

  if (userAuthenticated) {
    const userInfo = userAuthenticated.querySelector('.user-info');
    const logout = userAuthenticated.querySelector('#btnLogout');

    if (!logged) {
      if (userInfo) userInfo.style.display = 'none';
      if (logout) logout.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (registerBtn) registerBtn.style.display = 'inline-block';
    } else {
      if (userInfo) userInfo.style.display = 'flex';
      if (logout) logout.style.display = 'inline-block';
      if (loginBtn) loginBtn.style.display = 'none';
      if (registerBtn) registerBtn.style.display = 'none';
      ensureSessionDecorations();
    }
  }
}

/********************************
 *  PRODUCTOS DINÁMICOS         *
 ********************************/
let PRODUCTS_CACHE = [];

/**
 * Carga productos del backend filtrados por Activo=1 y Stock<=1.
 * Acepta respuesta como array o como { total, items }.
 */
// index.js — por si acaso, asegúrate de NO pasar maxStock en el fetch:
async function fetchProductsLowStock() {
  const url = apiUrl('/api/productos?activo=1'); // ⬅️ sin &maxStock=1
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  const payload = await res.json();
  return Array.isArray(payload) ? payload : (payload?.items ?? []);
}


function makeProductCard(p) {
  // Compatibilidad de campos (normalizado o crudo)
  const name = p.name ?? p.Nombre ?? '';
  const ref  = p.ref  ?? p.RefModelo ?? p.IdProducto ?? '';
  const price = Number(p.price ?? p.Precio ?? 0);
  const stock = Number(p.stock ?? p.Stock ?? 0);
  const imgSrc = p.image ?? p.Image ?? 'img/placeholder.jpg';
  const description = p.description ?? p.Descripcion ?? '';

  const div = document.createElement('div');
  div.className = 'product-card';
  div.dataset.productId = ref;

  // Contenedor media para poder colocar overlays por encima de la imagen
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
  overlaySold.className = 'sold-out-overlay';
  overlaySold.textContent = 'Sold Out';
  // Estilos inline para centrar sobre la imagen
  Object.assign(overlaySold.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '6px 10px',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    borderRadius: '8px',
    zIndex: '2',
    pointerEvents: 'none' // Evita que el overlay interfiera con clics
  });
  media.appendChild(overlaySold);
} else if (stock === 1) {
  const overlayLow = document.createElement('div');
  overlayLow.className = 'sold-out-overlay';
  overlayLow.textContent = '¡Último!';
  // Centrado perfecto sobre la imagen, con opacidad al 40%
  Object.assign(overlayLow.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '8px 14px',
    textAlign: 'center',
    backgroundColor: 'rgba(255,165,0,0.4)', // 40% de opacidad
    color: '#ffffffff',
    border: '1px solid rgba(255,165,0,0.7)',
    borderRadius: '10px',
    fontWeight: '600',
    zIndex: '2',
    pointerEvents: 'none'
  });
  media.appendChild(overlayLow);
}

  // Agregar al carrito
  btn.addEventListener('click', () => {
    if (btn.disabled) return;

    addItemToGuestCart({
      id: String(ref),
      name,
      price,
      img: imgSrc,
      qty: 1,
      stock
    });

    renderCartFromStorage();

    btn.innerHTML = '<i class="fas fa-check"></i> Agregado!';
    btn.style.backgroundColor = '#20c997';
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-plus"></i> Agregar al carrito';
      btn.style.backgroundColor = '#0d6efd';
    }, 1200);
  });

  return div;
}


function renderProducts(list) {
  productsGrid.innerHTML = '';
  if (!list.length) {
    productsGrid.innerHTML = `<p style="text-align:center;color:#6c757d">No hay productos con Stock ≤ 1 y Activo = 1.</p>`;
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(p => frag.appendChild(makeProductCard(p)));
  productsGrid.appendChild(frag);
}

/********************************
 *  BUSCADOR / SWITCH STOCK     *
 ********************************/
// 🔁 (Opcional recomendado) Reemplaza applyFilters para buscar por nombre o RefModelo de forma robusta:
function applyFilters() {
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

/********************************
 *  EVENTOS UI (carrito, auth)  *
 ********************************/
cartBtn?.addEventListener('click', () => {
  if (cartModal.classList.contains('active')) {
    cartModal.classList.remove('active');
    overlay.classList.remove('active');
  } else {
    cartModal.classList.add('active');
    overlay.classList.add('active');
    if (isLoggedIn()) {
      // Si tienes este endpoint, déjalo. Si no, puedes comentarlo.
      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(readGuestCart())
      }).then(() => renderCartFromStorage()).catch(err => console.error('Sync failed:', err));
    }
  }
});
closeCart?.addEventListener('click', () => {
  cartModal?.classList.remove('active');
  overlay?.classList.remove('active');
});
overlay?.addEventListener('click', (e) => {
  if (e.target === overlay) {
    cartModal?.classList.remove('active');
    overlay?.classList.remove('active');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cartModal.classList.contains('active')) {
    cartModal.classList.remove('active');
    overlay.classList.remove('active');
  }
});

const checkoutBtn = document.querySelector(".checkout-btn");
const checkoutMsg = document.getElementById("checkout-message");
let checkoutMsgTimeout;
function showCheckoutMessage(text, type = "error") {
  if (!checkoutMsg) return;
  checkoutMsg.textContent = text || "";
  checkoutMsg.className = "checkout-message " + (text ? type : "");
  if (text) {
    clearTimeout(checkoutMsgTimeout);
    checkoutMsgTimeout = setTimeout(() => {
      checkoutMsg.textContent = "";
      checkoutMsg.className = "checkout-message";
    }, 4000);
  }
}
checkoutBtn?.addEventListener("click", () => {
  if (!isLoggedIn()) {
    showCheckoutMessage("❌ Para guardar y confirmar tu orden, por favor, inicia sesión o crea una cuenta.", "error");
    return;
  }
  showCheckoutMessage("✅ Orden confirmada. Procesando...", "success");
});
closeCart?.addEventListener("click", () => showCheckoutMessage(""));
overlay?.addEventListener("click", () => showCheckoutMessage(""));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") showCheckoutMessage("");
});

logoutBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('nombre');
  localStorage.removeItem('correo');
  window.location.reload();
});

[loginBtn, loginBtn2].forEach(btn => btn && btn.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = '/login.html';
}));
[registerBtn, registerBtn2].forEach(btn => btn && btn.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = '/registrarse.html';
}));

/********************************
 *  INICIALIZACIÓN              *
 ********************************/
toggleNavbar();
renderCartFromStorage();
updateCartTotals();
syncCounter();

// INICIALIZACIÓN (reemplaza el IIFE completo)
(async function initProducts() {
  try {
    const arr = await fetchProductsLowStock();
    // Normaliza y deja solo activos
    PRODUCTS_CACHE = (arr || []).map(normalizeProduct).filter(p => p.activo === 1);

    // Switch encendido al iniciar y aplica filtro (oculta stock 0)
    if (stockOnlySwitch) stockOnlySwitch.checked = true;
    applyFilters();
  } catch (err) {
    console.error(err);
    productsGrid.innerHTML = `<p style="text-align:center;color:#dc3545">No se pudieron cargar los productos.</p>`;
  }
})();




searchInput?.addEventListener("input", applyFilters);
stockOnlySwitch?.addEventListener("change", applyFilters);
