/***********************
 *  CONFIGURACIÓN API  *
 ***********************/
const API_BASE = ""; 
// 👉 Si usas proxy en Vite, déjalo vacío ("") y tus fetch serán a "/api/..."
// 👉 Si NO usas proxy, pon la URL de tu API, por ejemplo:
// const API_BASE = "https://localhost:7044";

function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

/***********************
 *  AUTENTICACIÓN UTIL *
 ***********************/
function hasToken() { return !!localStorage.getItem('token'); }
function isLoggedIn() { return hasToken(); }

/***********************
 *  CARRITO (UI REFS)  *
 ***********************/
const cartBtn = document.getElementById('cart-btn');
const closeCart = document.getElementById('close-cart');
const cartModal = document.getElementById('cart-modal');
const overlay = document.getElementById('overlay');

const cartCount = document.querySelector('.cart-count');
const cartItemsContainer = document.querySelector('.cart-items');

// Total (robusto): usa #total-amount si existe; si no, cae a .total-amount
const totalEl =
  document.getElementById('total-amount') ||
  document.querySelector('.total-amount');

/********************************
 *  CARRITO (PERSISTENCIA LOCAL) *
 ********************************/
const GUEST_CART_KEY = 'guestCart'; // { items: [{id, name, price, img, qty, stock}] }

function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.items) ? parsed : { items: [] };
  } catch {
    return { items: [] };
  }
}

function writeGuestCart(cart) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart || { items: [] }));
}

function updateQtyGuestCart(id, qty) {
  const cart = readGuestCart();
  const it = cart.items.find(x => x.id === id);
  if (it) {
    it.qty = Math.max(1, Number(qty) || 1);
    writeGuestCart(cart);
  }
}

function removeItemFromGuestCart(id) {
  const cart = readGuestCart();
  cart.items = cart.items.filter(x => x.id !== id);
  writeGuestCart(cart);
}

/***********************
 *    FORMATEO NÚMERO  *
 ***********************/
function formatNumber(number, decimals = 0) {
  return Number(number).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/***********************
 *   RENDER DEL CARRITO
 ***********************/
function renderCartFromStorage() {
  const cart = readGuestCart();
  cartItemsContainer.innerHTML = '';

  if (!cart.items.length) {
    cartItemsContainer.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
    if (cartCount) cartCount.textContent = '0';
    updateCartTotals();
    return;
  }

  // Contador burbuja
  const totalCount = cart.items.reduce((acc, it) => acc + (Number(it.qty) || 1), 0);
  if (cartCount) cartCount.textContent = String(totalCount);

  // Render items
  cart.items.forEach(it => {
    const cartItem = document.createElement('div');
    cartItem.classList.add('cart-item');
    cartItem.dataset.productId = it.id;
    cartItem.innerHTML = `
      <img src="${it.img}" alt="${it.name}" class="cart-item-image">
      <div class="cart-item-info">
        <h4 class="cart-item-name">${it.name}</h4>
        <p class="cart-item-id">ID: ${it.id}</p>
        <p class="cart-item-price">$${formatNumber(it.price, 2)}</p>
        <div class="cart-item-controls">
          <button class="quantity-btn minus" aria-label="Disminuir">-</button>
          <input type="number" class="cart-item-quantity" value="${it.qty}" min="1" aria-label="Cantidad">
          <button class="quantity-btn plus" aria-label="Aumentar">+</button>
          <button class="remove-item" aria-label="Eliminar">Eliminar</button>
        </div>
      </div>
    `;
    cartItemsContainer.appendChild(cartItem);

    // Eventos: disminuir
    cartItem.querySelector('.quantity-btn.minus')?.addEventListener('click', () => {
      const input = cartItem.querySelector('.cart-item-quantity');
      let q = Math.max(1, (parseInt(input.value) || 1) - 1);
      input.value = q;
      updateQtyGuestCart(it.id, q);
      updateCartTotals();
      syncCounter();
    });

    // Eventos: aumentar
    cartItem.querySelector('.quantity-btn.plus')?.addEventListener('click', () => {
      const input = cartItem.querySelector('.cart-item-quantity');
      let q = (parseInt(input.value) || 1) + 1;
      input.value = q;
      updateQtyGuestCart(it.id, q);
      updateCartTotals();
      syncCounter();
    });

    // Cambiar manualmente
    cartItem.querySelector('.cart-item-quantity')?.addEventListener('input', (e) => {
      let q = parseInt(e.target.value);
      if (isNaN(q) || q < 1) q = 1;
      e.target.value = q;
      updateQtyGuestCart(it.id, q);
      updateCartTotals();
      syncCounter();
    });

    // Eliminar
    cartItem.querySelector('.remove-item')?.addEventListener('click', () => {
      cartItem.remove();
      removeItemFromGuestCart(it.id);
      if (!readGuestCart().items.length) {
        cartItemsContainer.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
      }
      updateCartTotals();
      syncCounter();
    });
  });

  updateCartTotals();
}

function syncCounter() {
  const cart = readGuestCart();
  const count = cart.items.reduce((a, b) => a + (Number(b.qty) || 1), 0);
  if (cartCount) cartCount.textContent = String(count);
}

/***********************
 *    TOTALES (SOLO TOTAL)
 ***********************/
// Format number with commas as thousand separators and two decimal places
function formatNumber(number, decimals = 0) {
  return Number(number).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Update cart totals
function updateCartTotals() {
  const cart = readGuestCart();
  const total = cart.items.reduce((sum, it) => {
    const price = Number(it.price) || 0;
    const qty = Number(it.qty) || 1;
    return sum + price * qty;
  }, 0);
  if (totalEl) totalEl.textContent = `$${formatNumber(total, 2)}`;
}

/***********************
 *   ABRIR / CERRAR MODAL
 ***********************/
cartBtn?.addEventListener('click', () => {
  const isActive = cartModal.classList.contains('active');
  if (isActive) {
    cartModal.classList.remove('active');
    overlay.classList.remove('active');
  } else {
    cartModal.classList.add('active');
    overlay.classList.add('active');
    // Render al abrir para asegurar sincronía visual
    renderCartFromStorage();
  }
});

closeCart?.addEventListener('click', () => {
  cartModal.classList.remove('active');
  overlay.classList.remove('active');
});
overlay?.addEventListener('click', () => {
  cartModal.classList.remove('active');
  overlay.classList.remove('active');
});

/***********************
 *   REGISTRO DE CLIENTE
 ***********************/
const registerForm = document.getElementById("register-form");
const errorEl = document.getElementById("register-error");

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  errorEl.style.display = "none";

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const pass1Input = document.getElementById("password");
  const pass2Input = document.getElementById("password-repeat");

  const nombre = (nameInput?.value || "").trim();
  const correo = (emailInput?.value || "").trim().toLowerCase(); // 🔹 normalizado en minúsculas
  const contrasena1 = pass1Input?.value || "";
  const contrasena2 = pass2Input?.value || "";

  // Validaciones frontend
  if (nombre.length < 3) {
    showError("❌ El nombre debe tener más de 3 caracteres.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    showError("❌ El correo no tiene un formato válido.");
    return;
  }
  if (contrasena1 !== contrasena2) {
    showError("❌ Las contraseñas no coinciden.");
    return;
  }

  const nuevoCliente = { nombre, correo, contrasena: contrasena1 };

  try {
    // 1) Crear cliente
    const res = await fetch(apiUrl("/api/clientes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoCliente)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }

    // 🔔 Mostrar alerta de éxito
    alert("✅ Cliente registrado con éxito.");

    // 2) Login automático con el mismo correo/contraseña
    const loginRes = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: nuevoCliente.correo,
        contrasena: nuevoCliente.contrasena
      })
    });

    if (!loginRes.ok) {
      const text = await loginRes.text();
      throw new Error(text || "No se pudo iniciar sesión automáticamente.");
    }

    const loginData = await loginRes.json();

    // 3) Guardar sesión en localStorage
    localStorage.setItem("token", loginData.token);
    localStorage.setItem("nombre", loginData.nombre || nuevoCliente.nombre);
    localStorage.setItem("correo", nuevoCliente.correo);

    // 4) Redirigir a index.html
    window.location.href = "index.html";
  } catch (err) {
    showError("❌ " + (err?.message || "Error inesperado."));
  }
});

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

/***********************
 *   ARRANQUE INICIAL
 ***********************/
renderCartFromStorage(); // pinta items + total al cargar
updateCartTotals();      // asegura total correcto si no había items
syncCounter();           // actualiza la burbuja del carrito
