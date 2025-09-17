// /js/login.js — Login con redirección por rol (admin → admin.html, resto → index.html)
'use strict';

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');

/* ================= Utilidades ================= */
function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg || 'Ha ocurrido un error.';
  errorBox.style.display = 'block';
}
function hideError() {
  if (!errorBox) return;
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}
function setSubmitting(isSubmitting) {
  if (!form) return;
  const btn = form.querySelector('[type="submit"]');
  if (!btn) return;
  btn.disabled = isSubmitting;
  btn.dataset.originalText ??= btn.textContent;
  btn.textContent = isSubmitting ? 'Ingresando…' : btn.dataset.originalText;
}
function decodeJwtPayload(token) {
  try { return JSON.parse(atob((token || '').split('.')[1] || '')) || {}; } catch { return {}; }
}
function getRoleFromToken(token) {
  const p = decodeJwtPayload(token);
  return String(
    p.role || p['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || ''
  ).toLowerCase();
}
function getClientIdFromToken(token) {
  const p = decodeJwtPayload(token);
  return p.sub || p.nameid || p.userId || p.idCliente || p.clienteId || null;
}
function redirectByRole(role) {
  location.href = role === 'admin' ? 'cpanel.html' : 'index.html';
}

/* =============== Manejador de login =============== */
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setSubmitting(true);

  const correo = document.getElementById('email')?.value.trim().toLowerCase();
  const contrasena = document.getElementById('password')?.value;

  if (!correo || !contrasena) {
    setSubmitting(false);
    showError('Completa correo y contraseña.');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSubmitting(false);
      showError(data?.message || 'Credenciales inválidas.');
      return;
    }

    // Guardar sesión
    const token = data.token || '';
    localStorage.setItem('token', token);
    localStorage.setItem('nombre', data.nombre || '');
    localStorage.setItem('correo', data.correo || '');

    // clienteId: de la respuesta o del JWT
    const cid = data.idCliente ?? data.clienteId ?? getClientIdFromToken(token);
    if (cid) localStorage.setItem('clienteId', String(cid));

    // rol: de la respuesta o del JWT (también lo guardamos para auto-redirect)
    let role = (data.rol || '').toLowerCase();
    if (!role) role = getRoleFromToken(token);
    if (role) localStorage.setItem('rol', role);

    // (debug opcional)
    console.log('[LOGIN] data.rol =', data.rol);
    console.log('[LOGIN] token role =', getRoleFromToken(token));
    console.log('[LOGIN] role used =', role);

    redirectByRole(role);
  } catch (err) {
    console.error('Error en login:', err);
    setSubmitting(false);
    showError('Error de red. Intenta de nuevo.');
  }
});

/* ====== Auto-redirect si ya hay sesión (ejecuta en login.html) ====== */
(function autoRedirectIfLogged() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Primero intenta con el valor guardado; si no, decodifica el JWT
  let role = (localStorage.getItem('rol') || '').toLowerCase();
  if (!role) role = getRoleFromToken(token);

  if (!role) return; // si no hay rol, no hacemos nada
  redirectByRole(role);
})();
