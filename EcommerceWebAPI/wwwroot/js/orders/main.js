
import { isLoggedIn, getNombre, getCorreo, getIniciales } from './utils.js';
import { initCart, renderCartFromStorage, updateCartTotals, syncCounter, showCheckoutMessage, bootstrapCartSession } from './cart.js';
import { initProducts } from './products.js';

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
const searchInput = document.getElementById('product-search');
const stockOnlySwitch = document.getElementById('stock-only');

const checkoutBtn = document.querySelector('.checkout-btn');
const checkoutMsg = document.getElementById('checkout-message');

if (productsGrid) {
  initProducts({ productsGrid, searchInput, stockOnlySwitch });
} else {
  // Estamos en páginas como checkout.html donde no hay grid de productos
  // Evitamos el TypeError y seguimos con el flujo normal del checkout
  console.debug('[products] grid no presente: skip initProducts() en esta página.');
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
 *  EVENTOS AUTH / NAV          *
 ********************************/
logoutBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('nombre');
  localStorage.removeItem('correo');
  localStorage.removeItem('clienteId');
  localStorage.removeItem('guestCart');
  // 👇👇 **NUEVO**: MUY IMPORTANTE
  localStorage.removeItem('guestCartFromBD');
  window.location.href = 'index.html';
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

// Inicializa carrito (UI + eventos + totales)
initCart({
  cartBtn, closeCart, cartModal, overlay, cartCount, cartItemsContainer, totalEl,
  checkoutBtn, checkoutMsg
});

function ensureClienteIdFromToken() {
  const cid = localStorage.getItem('clienteId');
  const tok = localStorage.getItem('token');
  if (!cid && tok) {
    try {
      const payload = JSON.parse(atob(tok.split('.')[1]));
      const val = payload.sub || payload.nameid || payload.userId;
      if (val) localStorage.setItem('clienteId', String(val));
    } catch {}
  }
}

// ...
ensureClienteIdFromToken();

// Bootstrap de sesión/cart: crea/mergea/limpia y rehidrata SI hay sesión
(async () => {
  try {
    await bootstrapCartSession();
  } catch (err) {
    console.error('[BOOT] Error en bootstrapCartSession:', err);
  } finally {
    // Sincroniza contadores/totales por si el DOM arranca con datos previos
    renderCartFromStorage();
    updateCartTotals();
    syncCounter();
  }
})();


// Inicializa productos (grid + buscador + switch)
initProducts({ productsGrid, searchInput, stockOnlySwitch });
