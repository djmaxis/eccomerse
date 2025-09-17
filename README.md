# Plataforma de Comercio Electrónico · ASP.NET Core + SQLite + HTML/JS

**Resumen:** Proyecto full-stack educativo y productivo de e-commerce con ASP.NET Core Web API (.NET 8), SQLite y frontend en HTML/CSS/JavaScript. Incluye catálogo, carrito, checkout, órdenes, facturación, panel de administración, tracking de envíos, chatbot conectado a DeepSeek API, autenticación JWT, y lógica de inventario con triggers de base de datos.

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Stack Tecnológico](#stack-tecnológico)
- [Características](#características)
- [Arquitectura General](#arquitectura-general)
- [Estructura del Repositorio](#estructura-del-repositorio)
- [Prerrequisitos](#prerrequisitos)
- [Instalación](#instalación)
- [Uso](#uso)
- [Esquema de la Base de Datos](#esquema-de-la-base-de-datos)
- [Pruebas](#pruebas)
- [Despliegue](#despliegue)
- [Contribución](#contribución)
- [Solución de Problemas](#solución-de-problemas)
- [Licencia y Créditos](#licencia-y-créditos)
- [Apéndices](#apéndices)

## Descripción General

Esta Plataforma de Comercio Electrónico implementa una tienda en línea de extremo a extremo:

- Catálogo de productos con activación/desactivación, imágenes, precios y stock.
- Carrito y checkout, generación de órdenes y facturas.
- Estados de orden: Pagada, Enviada, Completada, Cancelada.
- Panel de administración (cpanel) para productos, gestión de estados y tracking de envíos.
- Chatbot en frontend que se conecta con DeepSeek API y responde sobre productos y estado de órdenes con un protocolo JSON; el frontend renderiza respuestas amigables.
- Autenticación JWT, capas DAL/BLL y Swagger para documentación de API.
- Triggers en SQLite para sincronizar stock y alimentar la tabla de Productos más vendidos.

**Audiencia:** estudiantes de ingeniería de software, desarrolladores junior/intermedios y pequeños negocios que buscan un e-commerce didáctico pero robusto.

## Stack Tecnológico

| Capa          | Tecnologías                                      | Notas                                                                 |
|---------------|--------------------------------------------------|-----------------------------------------------------------------------|
| **Frontend** | HTML5, CSS3, JavaScript (vanilla)                | Páginas: index.html, cpanel.html, cpanelshipping.html. Módulos JS: wwwroot/js/index/chatbot.js, wwwroot/js/cpanel/*. |
| **Backend**  | ASP.NET Core Web API (.NET 8)                    | Capas Ecommerce.DAL, Ecommerce.BLL; controladores REST, middlewares, Swagger. |
| **ORM**      | Entity Framework Core                           | DbContext AppDbContext, migraciones.                                  |
| **Base de datos** | SQLite                                      | Archivo Data/ecommerce.db con PRAGMA foreign_keys = ON.               |
| **Autenticación** | JWT                                      | Clave, Issuer y Audience configurables.                               |
| **Chatbot**  | DeepSeek API                                     | DEEPSEEK_API_KEY por variable de entorno; askDeepSeek(...).           |
| **Herramientas** | Swagger, SQLiteStudio, Postman                | Diagnóstico y pruebas manuales.                                       |
| **DevOps**   | GitHub Actions (CI), Docker (opcional)           | Build, test y despliegue.                                             |

## Características

### Funcionalidades de Usuario

- 🛍️ **Explorar catálogo** de productos activos (Activo = 1) con imagen y precio.
- 🧺 **Carrito de compras** y checkout para generar órdenes y facturas.
- 📦 **Seguimiento de envíos:** visualización de estados y número de tracking.
- 🤖 **Chatbot:** consulta de productos, preguntas frecuentes y estado de pedidos.

### Funcionalidades de Administrador

- 🗂️ **CPanel Productos:** alta/edición, activar/inactivar, validaciones de campos obligatorios (ej. refModelo, nombre, descripción, precio, stock).
- 🚚 **CPanel Shipping:**
  - Sección Órdenes pendientes de envío (estado Pagada) → Añadir tracking.
  - Sección Órdenes enviadas → Actualizar tracking.
  - Botón Ver orden completa que abre modal con detalle (imágenes incl.).

### Seguridad y Buenas Prácticas

- 🔐 **JWT** para proteger endpoints sensibles.
- 🧱 **CORS** configurable por ambiente.
- 🧾 **Validaciones** en backend y frontend (campos obligatorios, formatos).
- 🧪 **Estructura** preparada para pruebas unitarias e integración.

### Inventario y Analítica

- 📉 **Triggers de stock:** decremento al confirmar compra; reintegro al cancelar.
- 📈 **ProdMasVendidos:** contadores automáticos y UltimaVenta.
- 👤 **UsuariosRecurrentesDet:** registro de órdenes por cliente (métricas).

## Arquitectura General

```mermaid
flowchart LR
  subgraph Browser [Frontend (HTML/CSS/JS)]
    A[index.html] -->|fetch| B[/api/productos?activo=1/]
    A -->|fetch| C[/api/ordenes /api/auth /api/prodmasvendidos]
    A -->|askDeepSeek| D[DeepSeek API]
    A -->|modal| A
  end
  subgraph API [ASP.NET Core Web API]
    C1[AuthController] --> JWT[JWT]
    C2[ProductosController]
    C3[OrdenesController]
    C4[FacturasController]
    C5[ProdMasVendidosController]
    C6[ShippingController]
    C2 --> BLL((Ecommerce.BLL))
    C3 --> BLL
    C4 --> BLL
    C5 --> BLL
    C6 --> BLL
    BLL --> DAL[(Ecommerce.DAL / EF Core)]
  end
  subgraph DB [SQLite: Data/ecommerce.db]
    T1[(Producto)]
    T2[(OrdenCompra)]
    T3[(OrdenItem)]
    T4[(Factura)]
    T5[(FacturaItem)]
    T6[(Cliente)]
    T7[(Direccion)]
    T8[(Pago)]
    T9[(Carrito)]
    T10[(CarritoItem)]
    T11[(ClienteMetodoPago)]
    T12[(ProdMasVendidos)]
    T13[(EstatusOrden)]
    T14[(UsuariosRecurrentesDet)]
    TRG{{Triggers}}
  end
  BLL <--> DAL <--> DB
  TRG -. actualiza .-> T1
  TRG -. alimenta .-> T12
