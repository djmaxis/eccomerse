// login.js — maneja submit de login
const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');

function showError(msg) {
  errorBox.textContent = msg || 'Ha ocurrido un error.';
  errorBox.style.display = 'block';
}

function hideError() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

// --- LOGIN ---
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const correo = document.getElementById('email').value.trim().toLowerCase();
  const contrasena = document.getElementById('password').value;

  if (!correo || !contrasena) {
    showError('Completa correo y contraseña.');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena })
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.message || 'Credenciales inválidas.');
      return;
    }

    // Guardar sesión en localStorage
    // login.js (luego de un login OK)
    localStorage.setItem('token', data.token);
    localStorage.setItem('nombre', data.nombre || '');
    localStorage.setItem('correo', data.correo || '');

    // A) Si tu API devuelve clienteId en la respuesta del login:
    if (data.clienteId) {
      localStorage.setItem('clienteId', String(data.clienteId));
    } else {
      // B) Respaldo: intentar sacarlo del JWT
      try {
        const payload = JSON.parse(atob((data.token || '').split('.')[1]));
        const cid = payload.sub || payload.nameid || payload.userId;
        if (cid) localStorage.setItem('clienteId', String(cid));
      } catch (e) {
        console.warn('[LOGIN] No se pudo decodificar el token para clienteId', e);
      }
    }


    // Redirigir al home
    window.location.href = '/index.html';
  } catch (err) {
    console.error('Error en login:', err);
    showError('Error de red. Intenta de nuevo.');
  }
});

// Si ya hay token, evita que vean login y llévalos al home
(function autoRedirectIfLogged() {
  const token = localStorage.getItem('token');
  if (token) window.location.href = '/index.html';
})();
