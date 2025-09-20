# 🛒 EEV Store – Plataforma de e‑commerce (ASP.NET Core + SQLite + Frontend estático)

[![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![ASP.NET Core Web API](https://img.shields.io/badge/ASP.NET%20Core-Web%20API-5C2D91)](https://learn.microsoft.com/aspnet/core)
[![SQLite](https://img.shields.io/badge/SQLite-DB-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Vanilla JS](https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-111?logo=javascript)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**EEV Store** es una solución full‑stack para tiendas físicas/online con **backend en ASP.NET Core Web API** y **base de datos SQLite**, y un **frontend 100% estático** (HTML + CSS + JS) servido desde `wwwroot/`. Incluye panel administrativo (**cpanel**) para productos, pedidos, envíos, métricas y soporte para reglas de negocio con **triggers** en la base de datos.

> Repositorio: `https://github.com/djmaxis/eccomerse`  
> Frontend: **sin frameworks** (no React), solo HTML/CSS/JS modular en `wwwroot/`.

---

## 📑 Tabla de contenidos
- [Arquitectura](#arquitectura)
- [Características](#características)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos](#requisitos)
- [Configuración rápida](#configuración-rápida)
- [Backend (ASP.NET Core)](#backend-aspnet-core)
- [Base de datos (SQLite)](#base-de-datos-sqlite)
- [Frontend estático (wwwroot)](#frontend-estático-wwwroot)
- [Endpoints principales](#endpoints-principales)
- [Variables de entorno](#variables-de-entorno)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contribución](#contribución)
- [Licencia](#licencia)

---

## Arquitectura

```text
Frontend (HTML/CSS/JS en wwwroot)  ──────►  ASP.NET Core Web API  ──────►  SQLite
                        archivos estáticos            BLL/DAL                triggers/FK
```

- **Frontend estático**: páginas HTML en `wwwroot/` con scripts JS modulares (`/js/orders`, `/js/cpanel`, etc.).
- **API REST**: controladores ASP.NET Core con capas **DAL/BLL** y DTOs.
- **SQLite**: BD embebida con **FK**, **CHECK**, **índices**, **triggers** para stock, estados y métricas.

---

## Características

- 🔐 API REST en **ASP.NET Core** con separación **DAL / BLL / API**.
- 🗃️ **SQLite** con integridad referencial y reglas de negocio (triggers).
- 🧾 **Órdenes**: cálculo de totales y **ajuste de stock** automático.
- 🚚 **Envíos** con `TrackingNumber` y estados: `Pagada`, `Enviada`, `Completada`, `Cancelada`.
- 📈 **Métricas**: Productos más vendidos, Usuarios recurrentes, Sumatoria ventas/ganancias.
- 🧰 **CPanel** en HTML/JS: tablas filtrables, modales de detalle, badges por estado, acciones (cancelar, ver factura, rastrear).

---

## Estructura del repositorio

```
eccomerse/
├─ EcommerceWebAPI/                 # Backend ASP.NET Core
│  ├─ Controllers/
│  ├─ BLL/
│  ├─ DAL/
│  ├─ Models/
│  ├─ Data/                         # ecommerce.db (SQLite) y seeds
│  ├─ wwwroot/                      # Frontend estático
│  │  ├─ css/
│  │  ├─ img/
│  │  ├─ js/
│  │  │  ├─ orders/                 # orders.js, order-details modal, helpers
│  │  │  └─ cpanel/                 # cpanel.js, get_data_orders.js, shipping.js, etc.
│  │  ├─ index.html
│  │  ├─ cpanel.html
│  │  ├─ cpanelshipping.html
│  │  ├─ orders.html
│  │  └─ mi_perfil.html
│  ├─ appsettings.json
│  ├─ Program.cs
│  └─ EcommerceWebAPI.csproj
└─ README.md
```

---

## Requisitos

- **.NET SDK 8.0+**  
- **SQLite 3** (opcional, para inspección desde CLI)  
- **Navegador moderno** (sirviendo estáticos desde la API)  

> No se requiere Node.js ni frameworks del lado del cliente.

---

## Configuración rápida

```bash
git clone https://github.com/djmaxis/eccomerse
cd eccomerse/EcommerceWebAPI

# 1) Restaurar, compilar y ejecutar
dotnet restore
dotnet build
dotnet run

# 2) Abre el frontend
#   https://localhost:7173/index.html
#   https://localhost:7173/orders.html
#   https://localhost:7173/cpanel.html
#   https://localhost:7173/cpanelshipping.html
```

**Conexión a SQLite** (`appsettings.json`):

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=Data/ecommerce.db;Cache=Shared"
  },
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } },
  "AllowedHosts": "*"
}
```

> Crea la carpeta `Data/` si no existe. Asegura permisos de escritura (Windows).

---

## Backend (ASP.NET Core)

- **Capas**: `Controllers` (API) ⇄ `BLL` (reglas) ⇄ `DAL` (repositorios/EF Core).
- **wwwroot**: sirve **HTML/CSS/JS** sin frameworks; usa la API vía `fetch`.
- **CORS**: si sirves estáticos desde la misma API no necesitas CORS; si separas, habilítalo en `Program.cs`.
- **Logging**: niveles por defecto en `appsettings.json`.

---

## Base de datos (SQLite)

**Tablas principales** (extracto):
- `Cliente (IdCliente, Nombre, Correo, Contrasena, FechaRegistro, Activo, Rol)`
- `OrdenCompra (IdOrden, IdCliente, IdDireccionEnvio, Estado, TrackingNumber, FechaCreacion, StockAjustado, CostoTotal)`
- `OrdenItem (IdOrdenItem, IdOrden, IdProducto, Cantidad, PrecioUnitario, CostoUnitario)`
- `EstatusOrden (IdEstatusOrden, IdOrden, NumeroOrden, Cliente, Fecha, Estatus)`
- `UsuariosRecurrentesDet (IdURD, IdOrden, IdCliente, Correo, Estado, TotalOrden, FechaOrden)`
- `ProdMasVendidos (...)`

**Triggers (resumen):**
- **CostoTotal** en `OrdenCompra`: suma `OrdenItem.CostoUnitario` al insertar/actualizar/borrar ítems.
- **Stock**: decrementa al pagar, repone al cancelar.
- **EstatusOrden**: inserta/actualiza historial por cambio de estado.
- **UsuariosRecurrentesDet**: agrega/actualiza por cliente/año con `TotalOrden`.
- **ProdMasVendidos**: actualiza conteos tras pagos/envíos.

> Usa **FK con ON DELETE CASCADE** y **CHECK (Estado IN (...))** para consistencia.

---

## Frontend estático (wwwroot)

- **Páginas**: `index.html`, `orders.html`, `cpanel.html`, `cpanelshipping.html`, `mi_perfil.html`.
- **Scripts** en `/js/`:
  - `orders/`: obtención e hidratación de órdenes, modal de detalles (`openOrderDetailsModal`), helpers.
  - `cpanel/`: listado de productos/órdenes, **badges** por estado, **greyeout** persistente para canceladas, acciones (cancelar/ver factura/rastrear), carga perezosa de módulos (shipping details).
- **Estilos** en `/css/`:
  - Utiliza variables (`:root`) y utilidades (badges, spinners, tablas responsivas).
- **Buenas prácticas**:
  - Evitar dobles listeners (usa `once: true` o control de montaje).
  - Un único **root del modal** `#order-details-modal` (creación perezosa).
  - `console.log` estratégicos en flujos críticos (carga de datos, modales, acciones).
  - No mezclar jQuery; si se usa, activar `$.noConflict()` y evitar redeclaración de `$`.

**Colores de estado:**
- `Pagada` → `#B8F2B1`
- `Enviada` → `#FFDD8A`
- `Completada` → `#CFCFCF`
- `Cancelada` → `#FF5C5C` (fila en greyeout + botones desactivados)

---

## Endpoints principales

> Ejemplos ilustrativos (ajústalos a tus controladores reales).

```
GET    /api/productos
POST   /api/productos
PUT    /api/productos/{id}
PATCH  /api/productos/{id}/inactivar
DELETE /api/productos/{id}

GET    /api/ordenes
GET    /api/ordenes/{id}
POST   /api/ordenes
PATCH  /api/ordenes/{id}/cancelar
PATCH  /api/ordenes/{id}/tracking

GET    /api/cpanel/metricas/ventas
GET    /api/cpanel/usuarios-recurrentes?year=2025
GET    /api/cpanel/prod-mas-vendidos?from=2025-01-01&to=2025-12-31
```

**Ejemplo `GET /api/ordenes/{id}`**

```json
{
  "IdOrden": 1024,
  "Cliente": { "IdCliente": 5, "Correo": "cliente@dominio.com" },
  "Estado": "Pagada",
  "FechaCreacion": "2025-09-16",
  "TrackingNumber": null,
  "Productos": [
    { "IdProducto": 12, "Nombre": "Teclado", "Cantidad": 1, "PrecioUnitario": 25.0, "CostoUnitario": 15.0 }
  ],
  "TotalOrden": 25.0,
  "CostoTotal": 15.0
}
```

---

## Variables de entorno

- `ASPNETCORE_ENVIRONMENT` = `Development` | `Production`
- **Conexión BD**: en `appsettings.json` (`Default` = `Data/ecommerce.db;Cache=Shared`)
- **JWT / claves externas (opcional)**: colocar en `appsettings*.json` y NO subir a Git

> **Nunca** publiques claves de OpenAI u otras en el repositorio. Usa `dotnet user-secrets` o variables de entorno.

---

## Troubleshooting

- **Error 14 / “unable to open database file”**  
  Crea `EcommerceWebAPI/Data/` y verifica permisos de escritura. Mantén `Cache=Shared`.

- **Doble modal / eventos duplicados**  
  Asegura un único `#order-details-modal`. Evita montar los scripts dos veces en la misma página.

- **Cliente no se muestra en columna**  
  Hidrata con `IdCliente` → carga `Cliente` (Correo/Nombre) antes del render de filas.

- **CORS**  
  Si sirves las páginas desde `wwwroot` de la misma API, no es necesario. Si separas hosting, habilítalo en `Program.cs`.

- **Rendimiento de tablas**  
  Implementa paginación y filtros server-side en endpoints de `ordenes`/`productos` para colecciones grandes.

---

## Roadmap

- [ ] Autenticación/roles (admin/cliente) con JWT simple.
- [ ] Paginación y `server-side filtering` en `ordenes` y `productos`.
- [ ] Exportaciones CSV/PDF desde CPanel.
- [ ] Webhooks de shipping / integración de pasarela de pagos.
- [ ] Migración opcional a Postgres/SQL Server para alta concurrencia.
- [ ] Tests unitarios y E2E (Playwright) de flujos críticos.

---

## Contribución

1. Haz **fork** del repo y crea rama `feat/nombre-feature`.
2. Sigue el estilo de código existente (C#, HTML/JS/CSS).
3. Envía PR con descripción, screenshots y checklist.
4. Mantén commits atómicos y descripciones claras.

---

## Licencia

Este proyecto se publica bajo **MIT**. Consulta `LICENSE`.
