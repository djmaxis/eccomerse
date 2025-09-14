# eccomerse

> Proyecto de e‑commerce desarrollado por **djmaxis**

Una aplicación modular para comercio electrónico, diseñada con capas separadas: acceso a datos, lógica de negocio y API. Permite manejar productos, usuarios, órdenes, etc.

---

## Índice

- [Características](#características)  
- [Tecnologías](#tecnologías)  
- [Estructura del proyecto](#estructura-del-proyecto)  
- [Requisitos](#requisitos)  
- [Instalación](#instalación)  
- [Configuración](#configuración)  
- [Uso / endpoints principales](#uso--endpoints-principales)  
- [Pruebas](#pruebas)  
- [Despliegue](#despliegue)  
- [Contribuciones](#contribuciones)  
- [Licencia](#licencia)  
- [Contacto](#contacto)

---

## Características

- Gestión de productos (CRUD: crear, leer, actualizar, eliminar)  
- Gestión de usuarios (registro, login, posiblemente roles)  
- Gestión de órdenes / carrito de compras  
- API REST para integración con front-end  
- Separación de responsabilidades: capa de Acceso a Datos (DAL), Lógica de Negocio (BLL), API Web  

---

## Tecnologías

- Lenguaje: C# (.NET)  
- Framework: ASP.NET Core Web API  
- ORM / base de datos: Entity Framework / SQL Server (o similar)  
- Front-end: JavaScript / HTML / CSS (si hay componente de front-end)  
- Gestión de dependencias: NuGet para .NET  
- Herramientas de desarrollo: Visual Studio, Visual Studio Code o IDE equivalente  

---

## Estructura del proyecto

```
eccomerse/
├── Ecommerce.DAL/             # Proyecto de acceso a datos
├── Ecommerce.BLL/             # Lógica de negocio / servicios
├── EcommerceWebAPI/           # Aplicación Web API
├── bk/                        # Backups o versiones antiguas
├── .editorconfig              
├── .gitignore                 
├── Ecommerce.sln              # Solución de Visual Studio
├── README.md                  
└── Ecommerce1.0.rar           # Paquete versión 1.0
```

---

## Requisitos

- .NET SDK (ej: .NET 6, .NET 7)  
- Visual Studio / Visual Studio Code  
- Base de datos SQL Server u otra compatible  
- Node.js (si hay front-end JS)  
- Variables de entorno seguras  

---

## Instalación

```bash
git clone https://github.com/djmaxis/eccomerse.git
cd eccomerse
dotnet restore
dotnet build
cd EcommerceWebAPI
dotnet ef database update
dotnet run --project EcommerceWebAPI
```

---

## Configuración

- `appsettings.json` para cadena de conexión  
- Variables de entorno para claves y secretos  
- `launchSettings.json` para puertos y entorno de desarrollo

---

## Uso / Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST   | /api/auth/register | Registro de usuario |
| POST   | /api/auth/login | Login |
| GET    | /api/products | Listar productos |
| POST   | /api/products | Crear producto |
| ...    | ... | ... |

---

## Pruebas

- Usar xUnit o NUnit  
- Crear proyecto `Ecommerce.Tests`  
- Probar lógica de negocio y controladores

---

## Despliegue

```bash
dotnet publish EcommerceWebAPI -c Release -o ./publish
```

- Subir a servidor o contenedor  
- Configurar base de datos de producción  
- Variables de entorno seguras

---

## Contribuciones

- Fork y Pull Request bien documentado  
- Estilo consistente y pruebas incluidas

---

## Licencia

MIT License

---

## Contacto

- Autor: djmaxis  
- Repositorio: https://github.com/djmaxis/eccomerse
