# 🛒 Ecommerce WebApp (SPA + API REST)

**Proyecto educativo completo de ecommerce** con funcionalidades modernas tipo carrito de compras, registro de clientes, órdenes y pagos. Esta solución incluye:

- ✅ Frontend SPA (HTML + JS vanilla, sin frameworks)
- ✅ Backend RESTful con ASP.NET Core Web API
- ✅ Base de datos relacional (SQLite por defecto)
- ✅ Lógica modular organizada en componentes reutilizables
- ✅ Persistencia de sesión via localStorage + JWT
- ✅ Separación clara entre capa API y vista cliente

---

## 🚀 Funcionalidades

### 🔐 Autenticación y Registro
- Registro y login de clientes (JWT)
- Validación de formularios
- Registro con login automático
- Protección contra acceso a zonas sin login

### 👥 Perfil y Métodos de Pago
- Actualización de datos personales
- CRUD de métodos de pago (tarjeta, Paypal, etc)
- API protegida por token de autenticación

### 📦 Productos y Carrito
- Catálogo de productos dinámico (`/api/productos`)
- Carrito persistente (localStorage si está offline)
- Render en tiempo real
- Ajuste de cantidades, remoción, total en vivo

### 🧾 Órdenes y Checkout
- Checkout funcional (crear Orden + Factura + Pago)
- Ajuste de stock automático por venta
- Seguimiento de estado de pedidos
- Visualización con máscara `ORD-yyyy-mm-dd#00000001`

---

## 🗂️ Estructura del Repositorio

```
📁 /wwwroot
├── 📄 index.html           # Página principal con catálogo
├── 📄 login.html           # Página de acceso
├── 📄 registrarse.html     # Registro nuevo cliente
├── 📄 checkout.html        # Confirmación de orden
├── 📄 metodo_pago.html     # Módulo de gestión de métodos de pago
├── 📄 orders.html          # Historial de pedidos del cliente
├── 📄 mi_perfil.html       # Edición de perfil
├── 📄 direcciones.html     # Gestión de direcciones
├── 📄 plantilla.html       # HTML base reutilizable
└── 📁 js/
    ├── main.js             # Común a toda la app (login check, carrito)
    ├── login.js            # Login del usuario
    ├── registrarse.js      # Registro nuevo cliente
    ├── products.js         # Render de productos activos
    ├── cart.js             # Carrito de compras
    ├── confirmar_pagar.js  # Cierre del checkout
    ├── metodo_pago.js      # Interfaz de métodos de pago
    ├── metodo_pago_api.js  # API CRUD métodos de pago
    ├── update_perfil.js    # Lógica para actualizar perfil
    ├── direcciones.js      # CRUD de direcciones
    ├── utils.js            # Funciones auxiliares comunes
    ├── chatbot.js          # Asistente virtual (con LLM)
    └── get_data_orders.js  # Carga y procesamiento de órdenes
```

---

## 📦 API Principal

La comunicación entre cliente y servidor se realiza con fetch + headers autenticados (`token` y `clienteId`).

### Endpoints destacados:

- `POST /api/auth/login` → Devuelve token y clienteId
- `POST /api/clientes` → Registro de nuevo cliente
- `GET /api/productos?activo=1` → Productos activos
- `POST /api/checkout/finalizar` → Crea orden + factura + pago
- `PUT /api/productos/stock-ajuste` → Ajuste de inventario
- `GET/POST/PUT/DELETE /api/clientes/{id}/metodos-pago` → CRUD

---

## 💬 Asistente Virtual

Incluye un `chatbot.js` que usa datos JSON locales para responder preguntas del cliente:

```json
{
  "ordenes": [
    {
      "IdOrden": 1,
      "mask": "ORD-2025-09-12#00000001",
      "Estado": "Pagado",
      "Productos": [
        { "Nombre": "...", "Precio": 0, "Cantidad": 0 }
      ]
    }
  ]
}
```

- Responde pedidos recientes, estado de orden, monto total, productos, etc.
- Usa animación typing (`setTimeout`) y lenguaje humano

---

## 📊 Datos de Ejemplo

En `/js/orders/get_data_orders.json` se incluye una orden simulada para pruebas:

```json
{
  "clienteId": 1,
  "ordenes": [ ... ]
}
```

---

## 🛠️ Requisitos

- Node.js (opcional para levantar servidor local)
- Backend en ASP.NET Core corriendo en `/api`
- Navegador moderno
- Editor recomendado: VSCode

---

## 🧠 Créditos y Reconocimientos

- Proyecto base diseñado por Enrique Escano, Erick Diaz, Victor Santos
- Componentes inspirados en prácticas modernas de desarrollo frontend modular
- Frontend SPA sin frameworks, ideal para proyectos educativos o introductorios

---

## 🧪 ToDo / Mejoras Futuras

- [ ] Validación de stock en tiempo real al agregar al carrito
- [ ] Integración con pasarela de pago real (Stripe/Paypal)
- [ ] Upload de imágenes de producto
- [ ] Soporte para múltiples direcciones por cliente
- [ ] Traducción i18n
- [ ] Administración (dashboard)

---

## 📸 Capturas

<img width="1854" height="958" alt="image" src="https://github.com/user-attachments/assets/dde30641-ad14-4eb8-9447-2578e293f9ec" />
<img width="519" height="691" alt="image" src="https://github.com/user-attachments/assets/1d71c6a9-0329-46b3-b407-63a4683cb0c7" />
<img width="454" height="757" alt="image" src="https://github.com/user-attachments/assets/3823dc98-2b5c-449f-9757-41da2d2b642c" />





---

## 📄 Licencia

MIT — libre para uso educativo, comercial, personal o empresarial.
