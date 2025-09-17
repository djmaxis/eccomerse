// wwwroot/js/orders/cancelar_estado_greyeout.js
(function () {
  // Aplica o quita el estado visual de cancelado a una card
  window.setOrderCancelledUI = function (card, isCancelled = true, mensaje = 'Orden Cancelada', opacity = 0.55) {
    if (!card) return;
    if (isCancelled) {
      card.classList.add('order--cancelled');
      card.style.setProperty('--cancel-opacity', String(opacity));
      let overlay = card.querySelector('.order-cancelled-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'order-cancelled-overlay';
        overlay.textContent = mensaje;
        card.appendChild(overlay);
      }
    } else {
      card.classList.remove('order--cancelled');
      card.style.removeProperty('--cancel-opacity');
      const overlay = card.querySelector('.order-cancelled-overlay');
      if (overlay) overlay.remove();
    }
  };
})();
