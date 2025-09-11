import { formatNumber, isLoggedIn, authHeaders, apiUrl, fetchJsonSafe } from './utils.js';

/*******************************************
 *  CARRITO (persistencia local invitado)  *
 *******************************************/
const GUEST_CART_KEY = 'guestCart'; // ya lo tienes
const GUEST_CART_FROM_BD_KEY = 'guestCartFromBD';

// cart.js (cerca de writeGuestCart / utilidades)
function clampQtyToStock(item) {
  const stock = Number(item.stock) || 0;
  const originalQty = Number(item.qty) || 1;
  let qty = originalQty;

  if (stock <= 0) qty = 0;
  else if (originalQty > stock) qty = stock;

  return { ...item, qty, _wasClamped: qty !== originalQty };
}

function getCartFromBDFlag() {
  return localStorage.getItem(GUEST_CART_FROM_BD_KEY) === '1';
}
function setCartFromBDFlag(v) {
  localStorage.setItem(GUEST_CART_FROM_BD_KEY, v ? '1' : '0');
}
function clearCartFromBDFlag() {
  localStorage.removeItem(GUEST_CART_FROM_BD_KEY);
}

// PUT exacto de cantidad (devuelve carrito DTO)
export async function apiSetItemQty(productId, newQty) {
  const url = apiUrl(`/api/carrito/items/${productId}?qty=${encodeURIComponent(newQty)}`);
  return await fetchJsonSafe(url, { method: 'PUT', headers: authHeaders(false) });
}

// DELETE ítem (devuelve carrito DTO)
export async function apiDeleteItem(productId) {
  const url = apiUrl(`/api/carrito/items/${productId}`);
  return await fetchJsonSafe(url, { method: 'DELETE', headers: authHeaders(false) });
}


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
  const exist = cart.items.find(x => x.id === item.id);
  if (exist) {
    const max = Number(item.stock ?? exist.stock ?? Infinity);
    exist.qty = Math.min((exist.qty || 1) + (item.qty || 1), max);
  } else {
    cart.items.push({ ...item, qty: Math.max(1, Number(item.qty) || 1) });
  }
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

  // Abrir/cerrar modal
  cartBtn?.addEventListener('click', () => {
    const open = cartModal.classList.contains('active');
    cartModal.classList.toggle('active', !open);
    overlay.classList.toggle('active', !open);
    showCheckoutMessage('');
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

  // Checkout (solo mensaje; la orden real la haces en tu backend)
  let checkoutMsgTimeout;
  function _show(text, type = 'error') {
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
  _els._showCheckoutMessage = _show;

  checkoutBtn?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      _show('❌ Para guardar y confirmar tu orden, inicia sesión o regístrate.', 'error');
      return;
    }
  });

  renderCartFromStorage();
  updateCartTotals();
  syncCounter();
}

export function renderCartFromStorage() {
  const { cartItemsContainer, cartCount } = _els;
  const cart = readGuestCart();

  // 👇 normaliza todo antes de render
  const fixedItems = (cart.items || []).map(clampQtyToStock);
  const changed = JSON.stringify(fixedItems) !== JSON.stringify(cart.items || []);
  if (changed) {
    writeGuestCart({ items: fixedItems });
  }

  const items = fixedItems; // usa esta variable en todo lo siguiente
  cartItemsContainer.innerHTML = '';
  if (!items.length) {
    cartItemsContainer.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
    if (cartCount) cartCount.textContent = '0';
    updateCartTotals();
    return;
  }

  let count = 0;
  cart.items.forEach(it => {
    count += it.qty;

    const isSoldOut = Number(it.stock) <= 0;

    const cartItem = document.createElement('div');
    cartItem.classList.add('cart-item');
    if (isSoldOut) cartItem.classList.add('sold-out');
    cartItem.dataset.productId = it.id;

    const showIdText = it.ref ? `Ref: ${it.ref}` : `ID: ${it.id}`;
    const priceChanged = it._priceWas != null && Number(it._priceWas) !== Number(it.price);
    const priceBadge = priceChanged
      ? `<span class="price-updated-badge" title="Antes: $${formatNumber(it._priceWas,2)}">Precio actualizado</span>`
      : '';

    cartItem.innerHTML = `
      ${isSoldOut ? '<div class="sold-out-badge">Sold out</div>' : ''}
      <img src="${it.img}" alt="${it.name}" class="cart-item-image">
      <div class="cart-item-info">
          <h4 class="cart-item-name">${it.name}</h4>
          <p class="cart-item-id">${showIdText}</p>
          <p class="cart-item-price">$${formatNumber(it.price, 2)} ${priceBadge}</p>
          <p class="cart-item-stock">Stock: ${it.stock}</p>
          <div class="cart-item-controls">
              <button class="quantity-btn minus">-</button>
              <input type="number" class="cart-item-quantity" value="${it.qty}" min="1">
              <button class="quantity-btn plus">+</button>
              <button class="remove-item">Eliminar</button>
          </div>
      </div>
    `;
    _els.cartItemsContainer.appendChild(cartItem);

    const minusBtn = cartItem.querySelector('.quantity-btn.minus');
    const plusBtn  = cartItem.querySelector('.quantity-btn.plus');
    const qtyInput = cartItem.querySelector('.cart-item-quantity');

    function applyPlusDisable() {
      const q = parseInt(qtyInput.value) || 1;
      plusBtn.disabled = q >= (Number(it.stock) || 0);
      if (Number(it.stock) <= 0) {
        qtyInput.disabled = true;
        plusBtn.disabled = true;
        minusBtn.disabled = true; // ← también el menos si no hay stock
      }
    }
    applyPlusDisable();

if (!isSoldOut) {
  minusBtn.addEventListener('click', async () => {
    let q = parseInt(qtyInput.value) || 1;
    if (q > 1) q--;
    qtyInput.value = q;

    if (isLoggedIn()) {
      // it.id puede ser Ref; para backend necesitamos ProductId numérico
      // Si en tu carrito local el id es numérico, basta con parseInt(it.id)
      const pid = parseInt(it.id, 10);
      const resp = await apiSetItemQty(pid, q);
      if (resp.ok) {
        hydrateLocalFromBD(resp.data); // rehidrata UI desde BD
      } else {
        showCheckoutMessage('No se pudo actualizar cantidad.', 'error');
      }
    } else {
      updateQtyGuestCart(it.id, q, it.stock);
      updateCartTotals();
      syncCounter();
      applyPlusDisable();
    }
  });

  plusBtn.addEventListener('click', async () => {
    let q = (parseInt(qtyInput.value) || 1) + 1;
    const max = Number(it.stock) || 0;
    if (q > max) q = max;
    qtyInput.value = q;

    if (isLoggedIn()) {
      const pid = parseInt(it.id, 10);
      const resp = await apiSetItemQty(pid, q);
      if (resp.ok) {
        hydrateLocalFromBD(resp.data);
      } else {
        showCheckoutMessage('No se pudo actualizar cantidad.', 'error');
      }
    } else {
      updateQtyGuestCart(it.id, q, it.stock);
      updateCartTotals();
      syncCounter();
      applyPlusDisable();
      if (q >= max) showCheckoutMessage('No puedes agregar más: stock máximo.', 'error');
    }
  });

  qtyInput.addEventListener('input', async () => {
    let q = parseInt(qtyInput.value);
    const max = Number(it.stock) || 0;
    if (isNaN(q) || q < 1) q = 1;
    if (q > max) q = max;
    qtyInput.value = q;

    if (isLoggedIn()) {
      const pid = parseInt(it.id, 10);
      const resp = await apiSetItemQty(pid, q);
      if (resp.ok) {
        hydrateLocalFromBD(resp.data);
      } else {
        showCheckoutMessage('No se pudo actualizar cantidad.', 'error');
      }
    } else {
      updateQtyGuestCart(it.id, q, it.stock);
      updateCartTotals();
      syncCounter();
      applyPlusDisable();
    }
  });
}

cartItem.querySelector('.remove-item').addEventListener('click', async () => {
  if (isLoggedIn()) {
    const pid = parseInt(it.id, 10);
    const resp = await apiDeleteItem(pid);
    if (resp.ok) {
      hydrateLocalFromBD(resp.data);
    } else {
      showCheckoutMessage('No se pudo eliminar el producto.', 'error');
    }
  } else {
    cartItem.remove();
    removeItemFromGuestCart(it.id);
    if (!readGuestCart().items.length) {
      _els.cartItemsContainer.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
    }
    updateCartTotals();
    syncCounter();
  }
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

// Utilidad interna para mostrar mensajes (se asigna en initCart)
export function showCheckoutMessage(text, type = 'error') {
  _els._showCheckoutMessage?.(text, type);
}

/* ===============================
   SINCRONIZACIÓN CON LA BASE DE DATOS
   =============================== */

/** Mapea DTO del backend a carrito local */
// cart.js -> reemplaza el map dentro de bdCartToGuest()
export function bdCartToGuest(cartDto) {
  const items = (cartDto?.items || cartDto?.Items || []).map(x => {
    const idNum = x.productId ?? x.ProductId ?? null;
    const ref = x.refModelo ?? x.RefModelo ?? null;
    const id = idNum != null ? String(idNum) : (ref ? String(ref) : '');

    const base = {
      id,
      ref,
      name: x.nombre ?? x.Nombre ?? 'Producto',
      price: Number(x.precioUnitario ?? x.PrecioUnitario ?? 0),
      img: x.imagenUrl ?? x.ImagenUrl ?? 'img/placeholder.jpg',
      qty: Number(x.cantidad ?? x.Cantidad ?? 1),
      stock: Number(x.stock ?? x.Stock ?? 0)
    };
    return clampQtyToStock(base); // 👈 aquí capamos siempre
  });
  return { items };
}


/** Marca items cuyo precio cambió (agrega _priceWas) y devuelve el nuevo carrito */
function mergeWithPriceUpdateFlag(localCart, mappedFromBD) {
  const localIndex = new Map((localCart.items || []).map(i => [String(i.id), i]));
  const newItems = (mappedFromBD.items || []).map(n => {
    const old = localIndex.get(String(n.id));
    if (old && Number(old.price) !== Number(n.price)) {
      return { ...n, _priceWas: Number(old.price) };
    }
    return n;
  });
  return { items: newItems };
}

/** Sobrescribe el carrito local desde la BD y refresca UI */
// cart.js -> dentro de hydrateLocalFromBD(cartDto)
export function hydrateLocalFromBD(cartDto) {
  const mapped = bdCartToGuest(cartDto);

  // si hubo capado, sincroniza BD con las cantidades nuevas
  const toFixOnServer = mapped.items.filter(i => i._wasClamped && /^\d+$/.test(i.id));
  if (toFixOnServer.length && isLoggedIn()) {
    Promise.allSettled(
      toFixOnServer.map(i => apiSetItemQty(parseInt(i.id, 10), i.qty))
    ).catch(() => {});
  }

  const current = readGuestCart();
  const withFlags = mergeWithPriceUpdateFlag(current, mapped);

  writeGuestCart(withFlags);
  setCartFromBDFlag(true);
  renderCartFromStorage();
  updateCartTotals();
  syncCounter();
}


/** GET /api/carrito/abierto (seguro contra 404 sin JSON) */
export async function apiGetOpenCart() {
  const url = apiUrl('/api/carrito/abierto');
  return await fetchJsonSafe(url, { headers: authHeaders(false), cache: 'no-store' });
}

/** POST /api/carrito con items (creación/merge en BD) */
export async function apiUpsertCartFrom(guestItems = []) {
  const url = apiUrl('/api/carrito');
  const payload = {
    items: (guestItems || []).map(x => {
      const pid = parseInt(x.id, 10);
      return {
        productId: Number.isInteger(pid) && pid > 0 ? pid : null,
        refModelo: (!Number.isInteger(pid) || pid <= 0) ? String(x.id || x.ref || '') : null,
        qty: Number(x.qty) || 1
      };
    })
  };
  return await fetchJsonSafe(url, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(payload) });
}

/**
 * Bootstrap al cargar index si el usuario está logueado.
 * - Caso A: no hay carrito en BD (404) ⇒ crea vacío o crea con items del local.
 * - Caso B: sí hay carrito en BD (200) ⇒ hidrata o mergea con local, según corresponda.
 * Siempre rehidrata desde la respuesta de BD y limpia el local si hubo merge.
 */
export async function bootstrapCartSession() {
  if (!isLoggedIn()) return;

  console.group('[BOOT] bootstrapCartSession');
  console.log('token?', true);
  console.log('clienteId', localStorage.getItem('clienteId'));

  const localCart = readGuestCart();
  const localHasItems = (localCart.items?.length || 0) > 0;
  const localIsFromBD = getCartFromBDFlag();        // 👈 nuevo
  console.log('guestCart items:', localCart.items?.length || 0, 'fromBD?', localIsFromBD);

  // 1) Intentar leer carrito abierto en BD
  const got = await apiGetOpenCart();
  console.log('GET /api/carrito/abierto ->', got.status, got.data);

  // === CASO A: NO HAY carrito en BD ===
  if (!got.ok && got.status === 404) {
    console.log('CASO A: No hay carrito en BD');
    if (!localHasItems) {
      console.log('A.1 local vacío -> crear carrito vacío en BD');
      const up = await apiUpsertCartFrom([]); // crea vacío
      console.log('POST /api/carrito (vacío) ->', up.status, up.data);
      if (up.ok) {
        hydrateLocalFromBD(up.data);          // set flag fromBD=true
      } else {
        // Si por alguna razón falla, mantén el local tal cual y NO marques fromBD
        console.warn('[BOOT] Crear vacío falló:', up.status);
      }
    } else {
      console.log('A.2 local con items (origen invitado) -> crear carrito con items');
      clearCartFromBDFlag();                  // 👈 asegurar que NO lo tratamos como BD
      const up = await apiUpsertCartFrom(localCart.items);
      console.log('POST /api/carrito (con items) ->', up.status, up.data);
      if (up.ok) {
        hydrateLocalFromBD(up.data);          // set flag fromBD=true y limpia local con BD
      } else {
        console.warn('[BOOT] Crear con items falló:', up.status);
      }
    }
    console.groupEnd();
    return;
  }

  // auth fallida
  if (!got.ok && got.status === 401) {
    console.warn('[BOOT] 401 al consultar /carrito/abierto.');
    console.groupEnd();
    return;
  }

  // === CASO B: SÍ HAY carrito en BD ===
  if (got.ok) {
    console.log('CASO B: Sí hay carrito en BD');
    const bdCart = got.data;

    // 🔑 Regla anti-dobles: si el local es "fromBD", NO mergeamos.
    if (!localHasItems || localIsFromBD) {
      console.log('B.1 local vacío o proviene de BD -> hidratar desde BD (sin merge)');
      hydrateLocalFromBD(bdCart);             // set flag fromBD=true internamente
    } else {
      // Solo mergea si el local NO proviene de BD (fue de invitado)
      console.log('B.2 local con items (origen invitado) -> MERGE en BD');
      clearCartFromBDFlag();
      const up = await apiUpsertCartFrom(localCart.items);
      console.log('POST /api/carrito (merge) ->', up.status, up.data);
      if (up.ok) {
        hydrateLocalFromBD(up.data);          // set flag fromBD=true
      } else {
        console.warn('[BOOT] Merge fallido. Hidratar BD original:', up.status);
        hydrateLocalFromBD(bdCart);           // aun así resetea local con BD
      }
    }
  }

  console.groupEnd();
}
