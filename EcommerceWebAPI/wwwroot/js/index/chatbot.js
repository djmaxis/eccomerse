// wwwroot/js/index/chatbot.js
(function () {
  // ===== Config =====
  const PMV_API = '/api/prodmasvendidos?days=360&take=50';

  let PMV = [];
  let readyPMV = false;

  const TYPE_DELAY_MS = 1000; // efecto "escribiendo" (conservado)
  const ORDERS_JSON = '/js/orders/get_data_orders.json';
  const PRODUCTS_API = '/api/productos?activo=1&take=200'; // ← productos activos

  // ===== Utils =====
  const $ = (sel, el = document) => el.querySelector(sel);
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));
  const wait = (ms) => new Promise(res => setTimeout(res, ms));
  const strip = (s) => (s || '').toString().trim();
  const pick = (o, A, a) => (o?.[A] ?? o?.[a]);
  // Texto normalizado (para matching)
  function norm(s=''){ return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); }
  const STOP = new Set(['de','del','la','el','los','las','un','una','para','con','y','o']);
  const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter(t => t && !STOP.has(t));

  // ===== Estado =====
  let ORDERS = { clienteId: null, ordenes: [] };
  let PRODUCTS = []; // ← aquí guardamos los productos activos
  let readyOrders = false;
  let readyProducts = false; // ← bandera de productos
  let primed = false;
  const history = []; // historial simple para enviar al LLM
  let _cbBooted = false;

  function isLoggedIn() {
    const token = localStorage.getItem('token');
    const cid = parseInt(localStorage.getItem('clienteId') || '', 10);
    return !!token && Number.isFinite(cid) && cid > 0;
  }
  function isIndexPage() {
    const p = location.pathname.toLowerCase();
    if (p === '/' || p.endsWith('/index.html')) return true;
    // Montar si el documento lo pide explícitamente
    if (document.body?.getAttribute('data-chatbot') === 'true') return true;
    // Lista blanca opcional
    const allow = ['/metodo_pago.html', '/direcciones.html','/orders.html','/mi_perfil.html'];
    return allow.some(a => p.endsWith(a));
  }

  function mountChatbot() {
    if (_cbBooted) return;
    _cbBooted = true;
    // monta UI y carga data
    injectStyles();
    buildUI();
    loadOrdersJson();
    loadProductsJson();
    loadPMVJson(); // <<< NUEVO: cargar PMV
  }
  function unmountChatbot() {
    if (!_cbBooted) return;
    _cbBooted = false;
    // desmonta UI
    document.getElementById('cb-launcher')?.remove();
    document.getElementById('cb-panel')?.remove();
    // limpia estado
    readyOrders = false;
    readyProducts = false;
    readyPMV = false;
    primed = false;
    ORDERS = { clienteId: null, ordenes: [] };
    PRODUCTS = [];
    PMV = [];
  }

  // ======== índice de órdenes para buscar por 1 o por ORD-aaaa-mm-dd#xxxxxx ========
  function ensureOrdersIndex() {
    if (!ORDERS) return;
    if (!ORDERS.index) ORDERS.index = { byAnyId: {} };
    if (!ORDERS.index.byAnyId) ORDERS.index.byAnyId = {};
    for (const o of (ORDERS.ordenes || [])) {
      const k1 = String(o.IdOrden);
      const k2 = String(o.IdOrderMask || '').toLowerCase();
      if (k1) ORDERS.index.byAnyId[k1] = o.IdOrden;
      if (k2) ORDERS.index.byAnyId[k2] = o.IdOrden;
    }
  }

  // ===== Cargas =====
  async function loadOrdersJson() {
    try {
      console.log('[chatbot] cargando', ORDERS_JSON);
      const r = await fetch(ORDERS_JSON, { cache: 'no-store' });
      if (!r.ok) {
        console.error('[chatbot] fetch falló:', r.status, await r.text());
        return;
      }
      const data = await r.json();
      const arr = Array.isArray(data?.ordenes) ? data.ordenes : [];
      ORDERS = { clienteId: data?.clienteId ?? null, ordenes: arr };
      ensureOrdersIndex(); // ← clave para resolver "1" o "ord-...#..."
      readyOrders = true;
      console.log('[chatbot] ORDERS cargado:', { clienteId: ORDERS.clienteId, total: arr.length, sample: arr[0] });
      document.dispatchEvent(new CustomEvent('orders:loaded', { detail: ORDERS }));
    } catch (e) {
      console.warn('[chatbot] No pude cargar get_data_orders.json:', e);
    }
  }
  async function loadProductsJson() {
    try {
      console.log('[chatbot] cargando productos', PRODUCTS_API);
      const r = await fetch(PRODUCTS_API, { cache: 'no-store' });
      if (!r.ok) {
        console.error('[chatbot] productos fetch falló:', r.status, await r.text());
        return;
      }
      const list = await r.json();
      PRODUCTS = (Array.isArray(list) ? list : [])
        .filter(p => Number(pick(p,'Activo','activo')) === 1)
        .map(p => ({
          IdProducto: pick(p,'IdProducto','idProducto'),
          RefModelo: pick(p,'RefModelo','refModelo'),
          Nombre: pick(p,'Nombre','nombre'),
          Precio: pick(p,'Precio','precio'),
          Stock: pick(p,'Stock','stock'),
          Activo: pick(p,'Activo','activo')
        }));
      readyProducts = true;
      window.CHAT_PRODUCTS = PRODUCTS; // debug opcional
      console.log('[chatbot] PRODUCTS cargados:', { total: PRODUCTS.length, sample: PRODUCTS[0] });
    } catch (e) {
      console.warn('[chatbot] No pude cargar productos activos:', e);
    }
  }
  // <<< NUEVO: carga de ProdMasVendidos
  async function loadPMVJson() {
    try {
      console.log('[chatbot] cargando PMV', PMV_API);
      const r = await fetch(PMV_API, { cache: 'no-store' });
      if (!r.ok) {
        console.error('[chatbot] PMV fetch falló:', r.status, await r.text());
        return;
      }
      PMV = await r.json();
      readyPMV = true;
      window.CHAT_PMV = PMV; // debug opcional
      console.log('[chatbot] PMV cargados:', { total: PMV.length, sample: PMV[0] });
    } catch (e) {
      console.warn('[chatbot] No pude cargar PMV:', e);
    }
  }

  // ===== UI (bot a la DERECHA) =====
  function injectStyles() {
    const css = `
#cb-launcher{
  position:fixed; right:18px; bottom:18px; width:64px; height:64px; border-radius:50%;
  background:#0ea5e9; box-shadow:0 8px 24px rgba(0,0,0,.25); cursor:pointer; z-index:9999;
  display:flex; align-items:center; justify-content:center; overflow:hidden; border:none;
  font-size: 32px;
}
#cb-panel{
  position:fixed; right:18px; bottom:96px; width:340px; max-height:70vh; background:#fff; border-radius:16px;
  box-shadow:0 16px 48px rgba(0,0,0,.25); display:none; flex-direction:column; overflow:hidden; z-index:10000;
  border:1px solid #e2e8f0;
}
#cb-header{ background:#0ea5e9; color:#fff; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; }
#cb-body{ padding:10px; overflow:auto; display:flex; flex-direction:column; gap:8px; min-height:140px; }
.cb-msg{ max-width:78%; padding:8px 10px; border-radius:12px; line-height:1.25; font-size:13px; }
.cb-user{ align-self:flex-end; background:#e2e8f0; color:#0f172a; }
.cb-bot{ align-self:flex-start; background:#f1f5f9; color:#0f172a; }
.cb-typing{ position:relative; background:#f1f5f9; color:#0f172a; }
.cb-typing .dots{ display:inline-block; width:36px; text-align:left; }
.cb-typing .dots span{ display:inline-block; width:6px; height:6px; margin:0 2px; background:#94a3b8; border-radius:50%; animation:cb-blink 1.2s infinite; }
.cb-typing .dots span:nth-child(2){ animation-delay:0.2s; }
.cb-typing .dots span:nth-child(3){ animation-delay:0.4s; }
@keyframes cb-blink{ 0%,80%,100%{ opacity:0.2 } 40%{ opacity:1 } }
#cb-inputbar{ display:flex; gap:8px; padding:10px; border-top:1px solid #e2e8f0; }
#cb-input{ flex:1; padding:8px 10px; border:1px solid #e2e8f0; border-radius:10px; outline:none; }
#cb-send{ background:#0ea5e9; color:#fff; border:none; border-radius:10px; padding:8px 12px; cursor:pointer; }
.cb-muted{ color:#64748b; font-size:12px; }
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  function buildUI() {
    // launcher
    const launcher = document.createElement('button');
    launcher.id = 'cb-launcher'; launcher.type = 'button';
    launcher.innerHTML = `🤖`;
    document.body.appendChild(launcher);
    console.log('[chatbot] launcher inyectado');
    // panel
    const panel = document.createElement('div');
    panel.id = 'cb-panel';
    panel.innerHTML = `
      <div id="cb-header">
        <strong>Asistente EEV</strong>
        <button id="cb-close" style="background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div id="cb-body"></div>
      <div id="cb-inputbar">
        <input id="cb-input" placeholder="Escribe tu pregunta..." />
        <button id="cb-send">Enviar</button>
      </div>`;
    document.body.appendChild(panel);
    // eventos
    launcher.addEventListener('click', async () => {
      panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
      if (panel.style.display === 'flex') {
        await ensureDataAndPrime(); // ← ahora ORDERS + PRODUCTS + PMV
        await botSay('¡Hola! Soy tu asistente 🤖. ¿En qué puedo ayudarte con tus pedidos o productos?');
      }
    });
    $('#cb-close', panel).addEventListener('click', () => { panel.style.display = 'none'; });
    $('#cb-send', panel).addEventListener('click', sendFromInput);
    $('#cb-input', panel).addEventListener('keydown', (e) => { if (e.key === 'Enter') sendFromInput(); });
    function sendFromInput() {
      const inp = $('#cb-input', panel);
      const text = (inp.value || '').trim();
      if (!text) return;
      pushUser(text);
      inp.value = '';
      askDeepSeek(text);
    }
    // helpers UI
    function pushBot(html) {
      const div = document.createElement('div');
      div.className = 'cb-msg cb-bot';
      div.innerHTML = html.replace(/\n/g,'<br>');
      $('#cb-body', panel).appendChild(div);
      $('#cb-body', panel).scrollTop = 1e9;
    }
    function pushUser(text) {
      const div = document.createElement('div');
      div.className = 'cb-msg cb-user';
      div.textContent = text;
      $('#cb-body', panel).appendChild(div);
      $('#cb-body', panel).scrollTop = 1e9;
      history.push({ role: 'user', content: text });
    }
    function showTyping() {
      const div = document.createElement('div');
      div.className = 'cb-msg cb-bot cb-typing';
      div.innerHTML = `<span class="dots"><span></span><span></span><span></span></span>`;
      $('#cb-body', panel).appendChild(div);
      $('#cb-body', panel).scrollTop = 1e9;
      return () => { div.remove(); };
    }
    async function botSay(html) {
      const stop = showTyping();
      await sleep(TYPE_DELAY_MS);
      stop();
      pushBot(html);
      // Guardar en historial sin HTML
      history.push({ role: 'assistant', content: strip(html.replace(/<[^>]+>/g,'')) });
    }

    // ===== IA (DeepSeek) vía backend =====
    async function askDeepSeek(prompt) {
      // Asegura datos listos y enviados al backend
      await ensureDataAndPrime();

      // Helper para extraer final_answer de distintas formas (objeto o string con ```json ... ```)
      function extractFinalAnswer(data) {
        if (data && typeof data === 'object' && typeof data.final_answer === 'string') {
          return data.final_answer;
        }
        const raw = (data?.reply || '').toString().trim();
        if (!raw) return '';
        const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = (m ? m[1] : raw).trim();
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed.final_answer === 'string') {
            return parsed.final_answer;
          }
        } catch {}
        return '';
      }

      // Flujo normal LLM (<<< incluye pmv)
      const payload = { prompt, context: { orders: ORDERS, products: PRODUCTS, pmv: PMV, history } };
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        const res = await fetch('/api/chatbot/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) {
          await botSay('Hubo un problema consultando la IA.');
          return;
        }
        const data = await res.json();
        let reply = extractFinalAnswer(data);
        if (!reply && typeof data?.final_answer === 'string') {
          reply = data.final_answer;
        }
        if (!reply) {
          const raw = (data?.reply || '').toString().trim();
          if (raw) {
            const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
            reply = (m ? m[1] : raw).trim();
          }
        }
        if (!reply) {
          await botSay('No tengo esa informacion');
          return;
        }
        await botSay(reply.replace(/\n/g, '<br>'));
      } catch (err) {
        await botSay(err?.name === 'AbortError'
          ? 'La solicitud tardó demasiado. Inténtalo de nuevo.'
          : 'No tengo esa informacion');
      }
    }

    // Garantiza que ÓRDENES + PRODUCTOS + PMV estén poblados y los envía (prime) al backend (con reintentos)
    async function ensureDataAndPrime() {
      // 1) Cargar si aún no están listos
      if (!readyOrders) await loadOrdersJson();
      if (!readyProducts) await loadProductsJson();
      if (!readyPMV)      await loadPMVJson();

      // 2) Reintentos si vinieron vacíos
      let tries = 0;
      while (readyOrders && (!ORDERS.ordenes || ORDERS.ordenes.length === 0) && tries < 3) {
        console.warn(`[chatbot] órdenes vacías, reintentando carga (${tries + 1}/3) en 800ms...`);
        await wait(800);
        await loadOrdersJson();
        tries++;
      }
      tries = 0;
      while (readyProducts && (!PRODUCTS || PRODUCTS.length === 0) && tries < 3) {
        console.warn(`[chatbot] productos vacíos, reintentando carga (${tries + 1}/3) en 800ms...`);
        await wait(800);
        await loadProductsJson();
        tries++;
      }
      tries = 0;
      while (readyPMV && (!PMV || PMV.length === 0) && tries < 3) {
        console.warn(`[chatbot] PMV vacío, reintentando carga (${tries + 1}/3) en 800ms...`);
        await wait(800);
        await loadPMVJson();
        tries++;
      }

      // 3) prime una sola vez con lo que haya (idealmente ya poblado)
      if (!primed && (readyOrders || readyProducts || readyPMV)) {
        try {
          const contextToSend = { orders: ORDERS, products: PRODUCTS, pmv: PMV };
          console.log('[chatbot] prime → enviando contexto:', {
            orders: ORDERS?.ordenes?.length ?? 0,
            products: PRODUCTS?.length ?? 0,
            pmv: PMV?.length ?? 0
          });
          const pr = await fetch('/api/chatbot/prime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contextToSend)
          });
          if (!pr.ok) {
            console.error('[chatbot] prime error:', pr.status, await pr.text());
          } else {
            primed = true;
            console.log('[chatbot] prime OK');
          }
        } catch (e) {
          console.warn('[chatbot] prime falló:', e);
        }
      }
    }
  }

  // ===== bootstrap seguro =====
  (function safeBoot(){
    try {
      const tryMount = () => {
        if (!isIndexPage()) return; // solo en index
        if (isLoggedIn()) {
          mountChatbot(); // hay sesión → mostrar chatbot
        } else {
          console.log('[chatbot] sin sesión activa; no se monta en index');
        }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryMount);
      } else {
        tryMount();
      }
      // Reacciona a login/logout en otras pestañas
      window.addEventListener('storage', (e) => {
        if (e.key === 'token' || e.key === 'clienteId') {
          if (isLoggedIn()) mountChatbot();
          else unmountChatbot();
        }
      });
    } catch (e) {
      console.error('[chatbot] fallo iniciando:', e);
    }
  })();
})();
