using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Ecommerce.DAL;
using Ecommerce.DAL.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // => /api/carrito
    public class CarritoController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public CarritoController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        // =========================
        // GET /api/carrito/abierto
        // =========================
        [HttpGet("abierto")]
        public async Task<IActionResult> GetAbierto()
        {
            var clienteId = ResolveClienteId();
            if (clienteId == null) return Unauthorized("Falta X-Cliente-Id o token.");

            var carrito = await _db.Carritos
                .Include(c => c.Items)
                .FirstOrDefaultAsync(c => c.IdCliente == clienteId && c.Estado == "abierto");

            if (carrito == null) return NotFound();

            // Sincroniza precios de CarritoItem con Producto.Precio si difieren
            await EnsureCarritoPricesUpToDateAsync(carrito);

            var dto = await MapToDtoAsync(carrito);
            return Ok(dto);
        }

        // PUT /api/carrito/items/{productId}?qty=NEW_QTY  (setea cantidad exacta)
        [HttpPut("items/{productId:int}")]
        public async Task<IActionResult> SetItemQuantity([FromRoute] int productId, [FromQuery] int qty)
        {
            var clienteId = ResolveClienteId();
            if (clienteId == null) return Unauthorized("Falta X-Cliente-Id o token.");

            var carrito = await _db.Carritos
                .Include(c => c.Items)
                .FirstOrDefaultAsync(c => c.IdCliente == clienteId && c.Estado == "abierto");
            if (carrito == null) return NotFound();

            var item = carrito.Items.FirstOrDefault(i => i.IdProducto == productId);
            // Si no existía y qty>0, lo creamos; si existe y qty==0, lo borramos
            var prod = await _db.Productos.FirstOrDefaultAsync(p => p.IdProducto == productId);
            if (prod == null) return NotFound("Producto no existe.");

            var stock = Math.Max(0, prod.Stock);
            var capped = Math.Min(Math.Max(qty, 0), stock);

            if (item == null && capped > 0)
            {
                carrito.Items.Add(new CarritoItem
                {
                    IdProducto = productId,
                    Cantidad = capped,
                    PrecioUnitario = prod.Precio  // siempre precio vigente
                });
            }
            else if (item != null)
            {
                if (capped == 0)
                    _db.CarritoItems.Remove(item);
                else
                {
                    item.Cantidad = capped;
                    if (item.PrecioUnitario != prod.Precio)
                        item.PrecioUnitario = prod.Precio;
                }
            }

            await _db.SaveChangesAsync();
            await EnsureCarritoPricesUpToDateAsync(carrito);
            var dto = await MapToDtoAsync(carrito);
            return Ok(dto);
        }

        // DELETE /api/carrito/items/{productId}
        [HttpDelete("items/{productId:int}")]
        public async Task<IActionResult> RemoveItem([FromRoute] int productId)
        {
            var clienteId = ResolveClienteId();
            if (clienteId == null) return Unauthorized("Falta X-Cliente-Id o token.");

            var carrito = await _db.Carritos
                .Include(c => c.Items)
                .FirstOrDefaultAsync(c => c.IdCliente == clienteId && c.Estado == "abierto");
            if (carrito == null) return NotFound();

            var item = carrito.Items.FirstOrDefault(i => i.IdProducto == productId);
            if (item != null) _db.CarritoItems.Remove(item);

            await _db.SaveChangesAsync();
            await EnsureCarritoPricesUpToDateAsync(carrito);
            var dto = await MapToDtoAsync(carrito);
            return Ok(dto);
        }


        // ====================
        // POST /api/carrito
        // - Crea si no existe
        // - Mergea items si hay
        // - Si items vacío, devuelve carrito (vacío o el existente)
        // ====================
        [HttpPost]
        public async Task<IActionResult> UpsertCarrito([FromBody] UpsertCartRequest body)
        {
            var clienteId = ResolveClienteId();
            if (clienteId == null) return Unauthorized("Falta X-Cliente-Id o token.");

            var carrito = await _db.Carritos
                .Include(c => c.Items)
                .FirstOrDefaultAsync(c => c.IdCliente == clienteId && c.Estado == "abierto");

            bool created = false;
            if (carrito == null)
            {
                carrito = new Carrito
                {
                    IdCliente = clienteId.Value,
                    Estado = "abierto",
                    FechaCreacion = DateTime.UtcNow,
                    Items = new List<CarritoItem>()
                };
                _db.Carritos.Add(carrito);
                created = true;
            }

            var incoming = body?.Items ?? new List<UpsertCartItem>();
            if (incoming.Count > 0)
            {
                foreach (var it in incoming)
                {
                    if (it.Qty <= 0) continue;

                    // Resolver producto por Id o RefModelo
                    Producto? prod = null;
                    if (it.ProductId.HasValue && it.ProductId.Value > 0)
                        prod = await _db.Productos.FirstOrDefaultAsync(p => p.IdProducto == it.ProductId.Value);
                    else if (!string.IsNullOrWhiteSpace(it.RefModelo))
                        prod = await _db.Productos.FirstOrDefaultAsync(p => p.RefModelo == it.RefModelo);

                    if (prod == null) continue;

                    var stock = Math.Max(0, prod.Stock);
                    var existente = carrito.Items.FirstOrDefault(x => x.IdProducto == prod.IdProducto);

                    if (existente == null)
                    {
                        var qty = Math.Min(it.Qty, stock);
                        if (qty <= 0) continue;

                        carrito.Items.Add(new CarritoItem
                        {
                            IdProducto = prod.IdProducto,
                            Cantidad = qty,
                            // Fijar siempre el unitario al precio vigente del producto
                            PrecioUnitario = prod.Precio
                        });
                    }
                    else
                    {
                        // Regla de negocio: SUMA cantidades (si prefieres "mayor", usa Math.Max)
                        var nueva = existente.Cantidad + it.Qty;
                        nueva = Math.Min(nueva, stock);

                        if (nueva <= 0)
                        {
                            _db.CarritoItems.Remove(existente);
                        }
                        else
                        {
                            existente.Cantidad = nueva;
                            // Actualiza también el precio unitario al vigente
                            if (existente.PrecioUnitario != prod.Precio)
                                existente.PrecioUnitario = prod.Precio;
                        }
                    }
                }
            }

            // Guarda cambios del merge
            await _db.SaveChangesAsync();

            // Asegura que, aunque no vengan items, los precios queden alineados con el catálogo
            await EnsureCarritoPricesUpToDateAsync(carrito);

            var dto = await MapToDtoAsync(carrito);
            return created ? Created("/api/carrito/abierto", dto) : Ok(dto);
        }

        // =========================
        // Helpers
        // =========================

        /// <summary>
        /// Sincroniza CarritoItem.PrecioUnitario con Producto.Precio si difieren.
        /// Devuelve true si hubo cambios (y hace SaveChanges).
        /// </summary>
        private async Task<bool> EnsureCarritoPricesUpToDateAsync(Carrito carrito)
        {
            var productIds = carrito.Items.Select(i => i.IdProducto).Distinct().ToList();

            var productos = await _db.Productos
                .Where(p => productIds.Contains(p.IdProducto))
                .ToDictionaryAsync(p => p.IdProducto);

            var changed = false;

            foreach (var it in carrito.Items)
            {
                if (!productos.TryGetValue(it.IdProducto, out var prod) || prod == null)
                    continue;

                // Si el precio vigente difiere del guardado en el item, actualízalo
                if (it.PrecioUnitario != prod.Precio)
                {
                    it.PrecioUnitario = prod.Precio;
                    changed = true;
                }

                // (Opcional) Ajustar cantidad contra stock vigente:
                // var stock = Math.Max(0, prod.Stock);
                // if (it.Cantidad > stock) { it.Cantidad = stock; changed = true; }
            }

            if (changed)
                await _db.SaveChangesAsync();

            return changed;
        }

        private int? ResolveClienteId()
        {
            // 1) JWT (sub/nameid), si lo estás usando
            if (User?.Identity?.IsAuthenticated == true)
            {
                var sub = User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value
                       ?? User.Claims.FirstOrDefault(c => c.Type.Contains("nameid", StringComparison.OrdinalIgnoreCase))?.Value;
                if (int.TryParse(sub, out var cid)) return cid;
            }
            // 2) Header provisional
            var headerCid = Request.Headers["X-Cliente-Id"].FirstOrDefault();
            if (int.TryParse(headerCid, out var hcid)) return hcid;

            return null;
        }

        // Construye URL de imagen según tu estructura wwwroot/img/{IdProducto}.(jpg|png|webp)
        private string ResolveProductImageUrlById(Producto? p)
        {
            if (p == null) return "/img/placeholder.jpg";

            var candidates = new List<string>
            {
                $"img/{p.IdProducto}.jpg",
                $"img/{p.IdProducto}.png",
                $"img/{p.IdProducto}.webp"
            };

            foreach (var rel in candidates)
            {
                var full = Path.Combine(_env.WebRootPath ?? "wwwroot", rel.Replace('/', Path.DirectorySeparatorChar));
                if (System.IO.File.Exists(full))
                    return "/" + rel.Replace("\\", "/");
            }

            return "/img/placeholder.jpg";
        }

private async Task<CarritoDto> MapToDtoAsync(Carrito carrito)
{
    var ids = carrito.Items.Select(i => i.IdProducto).Distinct().ToList();
    var productos = await _db.Productos
        .Where(p => ids.Contains(p.IdProducto))
        .ToDictionaryAsync(p => p.IdProducto);

    return new CarritoDto
    {
        Id = carrito.IdCarrito,
        ClienteId = carrito.IdCliente,
        Estado = carrito.Estado,
        Items = carrito.Items.Select(i =>
        {
            productos.TryGetValue(i.IdProducto, out var p);

            // Usa primero la imagen de la BD, si no existe cae al resolver por Id
            // Usa primero el campo de la entidad (Image) y si no, cae a archivo por Id
            var imageUrl = !string.IsNullOrWhiteSpace(p?.Image)
                ? p.Image
                : ResolveProductImageUrlById(p);


            return new CarritoItemDto
            {
                ProductId = i.IdProducto,
                RefModelo = p?.RefModelo,
                Nombre = p?.Nombre ?? "Producto",
                Cantidad = i.Cantidad,
                PrecioUnitario = i.PrecioUnitario,
                Stock = p?.Stock ?? 0,
                ImagenUrl = imageUrl
            };
        }).ToList()
    };
}

    }

    // =========================
    // DTOs
    // =========================
    public class UpsertCartRequest
    {
        public List<UpsertCartItem> Items { get; set; } = new();
    }

    public class UpsertCartItem
    {
        public int? ProductId { get; set; }
        public string? RefModelo { get; set; }
        public int Qty { get; set; }
    }

    public class CarritoDto
    {
        public int Id { get; set; }
        public int ClienteId { get; set; }
        public string Estado { get; set; } = "abierto";
        public List<CarritoItemDto> Items { get; set; } = new();
    }

    public class CarritoItemDto
    {
        public int ProductId { get; set; }
        public string? RefModelo { get; set; }
        public string Nombre { get; set; } = "";
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public int Stock { get; set; }
        public string? ImagenUrl { get; set; }
    }
}
