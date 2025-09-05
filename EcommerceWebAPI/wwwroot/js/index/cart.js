import { formatNumber, isLoggedIn, getToken } from './utils.js';

/*******************************************
 *  CARRITO (persistencia local invitado)  *
 *******************************************/
const GUEST_CART_KEY = 'guestCart'; // { items: [{id, name, price, img, qty, stock}] }

export function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.items) ? parsed : { items: [] };
  } catch { return { items: [] }; }
}
export function writeGuestCart(cart) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart || { items: [] }));
}
export function addItemToGuestCart(item) {
  const cart = readGuestCart();
  const existing = cart.items.find(x => x.id === item.id);
  if (existing) existing.qty = Math.min(existing.qty + item.qty, item.stock || existing.stock || 1);
  else cart.items.push(item);
  writeGuestCart(cart);
}
export function removeItemFromGuestCart(id) {
  const cart = readGuestCart();
  cart.items = cart.items.filter(x => x.id !== id);
  writeGuestCart(cart);
}
export function updateQtyGuestCart(id, qty, maxStock = Infinity) {
  const cart = readGuestCart();
  const it = cart.items.find(x => x.id === id);
  if (it) { 
    const capped = Math.max(1, Math.min(Number(qty) || 1, Number(maxStock) || Infinity));
    it.qty = capped; 
    writeGuestCart(cart); 
  }
}

/********************************
 *  RENDER CARRITO Y TOTALES    *
 ********************************/
let _els = {};
export function initCart({ 
  cartBtn, closeCart, cartModal, overlay, cartCount, cartItemsContainer, totalEl, 
  checkoutBtn, checkoutMsg 
}) {
  _els = { cartBtn, closeCart, cartModal, overlay, cartCount, cartItemsContainer, totalEl, checkoutBtn, checkoutMsg };

  // Botón carrito (abre/cierra y opcionalmente sincroniza si hay sesión)
  cartBtn?.addEventListener('click', () => {
    const open = cartModal.classList.contains('active');
    cartModal.classList.toggle('active', !open);
    overlay.classList.toggle('active', !open);

    if (!open && isLoggedIn()) {
      // Si tienes /api/cart/sync, úsalo. Si no, comenta este bloque.
      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(readGuestCart())
      }).then(() => renderCartFromStorage()).catch(err => console.error('Sync failed:', err));
    }
  });

  closeCart?.addEventListener('click', () => {
    cartModal?.classList.remove('active');
    overlay?.classList.remove('active');
    showCheckoutMessage('');
  });

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cartModal?.classList.remove('active');
      overlay?.classList.remove('active');
      showCheckoutMessage('');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartModal.classList.contains('active')) {
      cartModal.classList.remove('active');
      overlay.classList.remove('active');
      showCheckoutMessage('');
    }
  });

  // Checkout
  let checkoutMsgTimeout;
  function show(text, type = 'error') {
    if (!checkoutMsg) return;
    checkoutMsg.textContent = text || '';
    checkoutMsg.className = 'checkout-message ' + (text ? type : '');
    if (text) {
      clearTimeout(checkoutMsgTimeout);
      checkoutMsgTimeout = setTimeout(() => {
        checkoutMsg.textContent = '';
        checkoutMsg.className = 'checkout-message';
      }, 4000);
    }
  }
  _els._showCheckoutMessage = show;

  checkoutBtn?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      show('❌ Para guardar y confirmar tu orden, por favor, inicia sesión o crea una cuenta.', 'error');
      return;
    }
    show('✅ Orden confirmada. Procesando...', 'success');
  });

  renderCartFromStorage();
  updateCartTotals();
  syncCounter();
}

export function renderCartFromStorage() {
  const { cartItemsContainer, cartCount } = _els;
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

    const minusBtn = cartItem.querySelector('.quantity-btn.minus');
    const plusBtn  = cartItem.querySelector('.quantity-btn.plus');
    const qtyInput = cartItem.querySelector('.cart-item-quantity');

    function applyPlusDisable() {
      const q = parseInt(qtyInput.value) || 1;
      plusBtn.disabled = q >= (Number(it.stock) || Infinity);
    }
    applyPlusDisable();

    minusBtn.addEventListener('click', () => {
      let q = parseInt(qtyInput.value) || 1;
      if (q > 1) q--;
      qtyInput.value = q;
      updateQtyGuestCart(it.id, q, it.stock);
      updateCartTotals();
      syncCounter();
      applyPlusDisable();
    });

    plusBtn.addEventListener('click', () => {
      let q = (parseInt(qtyInput.value) || 1) + 1;
      const max = Number(it.stock) || Infinity;
      if (q > max) {
        q = max;
      }
      qtyInput.value = q;
      updateQtyGuestCart(it.id, q, it.stock);
      updateCartTotals();
      syncCounter();
      applyPlusDisable();
    });

    qtyInput.addEventListener('input', () => {
      let q = parseInt(qtyInput.value);
      const max = Number(it.stock) || Infinity;
      if (isNaN(q) || q < 1) q = 1;
      if (q > max) q = max;
      qtyInput.value = q;
      updateQtyGuestCart(it.id, q, it.stock);
      updateCartTotals();
      syncCounter();
      applyPlusDisable();
    });

    cartItem.querySelector('.remove-item').addEventListener('click', () => {
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

export function syncCounter() {
  const { cartCount } = _els;
  const cart = readGuestCart();
  const count = cart.items.reduce((a, b) => a + (b.qty || 1), 0);
  if (cartCount) cartCount.textContent = String(count);
}

export function updateCartTotals() {
  const { totalEl } = _els;
  const cart = readGuestCart();
  const total = cart.items.reduce((sum, it) => {
    const price = Number(it.price) || 0;
    const qty = Number(it.qty) || 1;
    return sum + price * qty;
  }, 0);
  if (totalEl) totalEl.textContent = `$${formatNumber(total, 2)}`;
}

// Utilidad interna para mostrar mensajes (se setea en initCart)
export function showCheckoutMessage(text, type = 'error') {
  _els._showCheckoutMessage?.(text, type);
}
