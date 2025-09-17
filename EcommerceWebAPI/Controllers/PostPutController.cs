using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Ecommerce.DAL;
using Ecommerce.DAL.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/postput")]
    public class PostPutController : ControllerBase
    {
        private readonly AppDbContext _db;

        public PostPutController(AppDbContext db)
        {
            _db = db;
        }

        // ========= D T O s  (entrada desde pre_order.json) =========
        public class PreOrderDto
        {
            public DireccionDto? Direccion_de_envio { get; set; }  // "Dirección de envío"
            public List<ProductoDto> Productos { get; set; } = new();
            public MetodoPagoDto? Metodos_de_pago { get; set; }    // "Métodos de pago"
            public ResumenDto Resumen_del_pedido { get; set; } = new();
            public DebugDto? Debug { get; set; }
        }
        public class DireccionDto { public int? id { get; set; } }
        public class ProductoDto
        {
            public int? idCarritoItem { get; set; }
            public int? idProducto { get; set; }
            public int cantidad { get; set; }
            public decimal precioUnitario { get; set; }
        }
        public class MetodoPagoDto
        {
            public int? id { get; set; }          // IdClienteMetodoPago
            public string? tipo { get; set; }     // 'tarjeta' | 'paypal'
        }
        public class ResumenDto
        {
            [Required] public decimal Total_del_pedido { get; set; }
            public string? Moneda { get; set; }
        }
        public class DebugDto
        {
            public int? clienteId { get; set; }
            public int? guestCartItems { get; set; }
            public int? dbCartId { get; set; }
            public int? dbItemsCount { get; set; }
        }

        // ========= REQUEST COMBINADO PARA EL POST =========
        public class CrearOrdenRequest
        {
            [Required] public int IdCliente { get; set; }
            public int? IdDireccionEnvio { get; set; }
            public string Estado { get; set; } = "Pagada";
            public string? TrackingNumber { get; set; } = "";
            public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

            [Required] public List<ProductoDto> Items { get; set; } = new();

            // si viene vacío o duplicado, se genera uno nuevo en servidor
            public string? NumeroFactura { get; set; } = "FAC-EEV-00001";
            public DateTime FechaEmision { get; set; } = DateTime.UtcNow;
            [Required] public decimal Total { get; set; }

            public int? IdClienteMetodoPago { get; set; }
        }
        public class CrearOrdenResponse
        {
            public int IdOrden { get; set; }
            public int IdFactura { get; set; }
            public int IdPago { get; set; }
            public string NumeroFactura { get; set; } = "";
        }

        // ========= DTO para PUT STOCK =========
        public class StockUpdateDto
        {
            [Required] public int IdProducto { get; set; }
            [Required] public int Cantidad { get; set; } // a descontar (positivo)
        }

        // ========= Helpers =========
        private static (string prefix, int num) ParseInvoiceNumber(string? numStr)
        {
            if (string.IsNullOrWhiteSpace(numStr)) return ("FAC-EEV-", 0);
            var m = Regex.Match(numStr, @"^(?<p>.*?)(?<n>\d+)$");
            if (!m.Success) return ("FAC-EEV-", 0);
            var prefix = m.Groups["p"].Value;
            if (!int.TryParse(m.Groups["n"].Value, out var n)) n = 0;
            return (prefix, n);
        }

        private async Task<string> GenerateNextInvoiceNumberAsync(string? desired)
        {
            // Si desired está libre, úsalo
            if (!string.IsNullOrWhiteSpace(desired))
            {
                var exists = await _db.Facturas.AnyAsync(f => f.NumeroFactura == desired);
                if (!exists) return desired;
            }

            // Busca el máximo existente con el mismo prefijo
            var (prefix, _) = ParseInvoiceNumber(desired ?? "FAC-EEV-00001");
            var list = await _db.Facturas
                                .Where(f => f.NumeroFactura.StartsWith(prefix))
                                .Select(f => f.NumeroFactura)
                                .ToListAsync();

            int max = 0;
            foreach (var s in list)
            {
                var (_, n) = ParseInvoiceNumber(s);
                if (n > max) max = n;
            }
            var next = max + 1;
            return $"{prefix}{next.ToString("D5")}";
        }

        private async Task<int?> ResolveMetodoPagoAsync(int idCliente, int? idClienteMetodoPago)
        {
            if (idClienteMetodoPago.HasValue && idClienteMetodoPago.Value > 0)
            {
                var ok = await _db.ClienteMetodosPago.AnyAsync(x =>
                    x.IdClienteMetodoPago == idClienteMetodoPago.Value &&
                    x.IdCliente == idCliente);
                if (ok) return idClienteMetodoPago.Value;
            }

            // Fallback: principal del cliente
            var principal = await _db.ClienteMetodosPago
                .Where(x => x.IdCliente == idCliente)
                .OrderByDescending(x => x.EsPrincipal)
                .ThenBy(x => x.IdClienteMetodoPago)
                .FirstOrDefaultAsync();

            return principal?.IdClienteMetodoPago;
        }

        // ========= POST: crea Orden + Items + Factura + FacturaItems + Pago =========
        [HttpPost("orden")]
        public async Task<ActionResult<CrearOrdenResponse>> CrearOrden([FromBody] CrearOrdenRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            // Resolver método de pago
            var mpId = await ResolveMetodoPagoAsync(req.IdCliente, req.IdClienteMetodoPago);
            if (!mpId.HasValue)
                return BadRequest("No hay método de pago válido para el cliente.");

            using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1) OrdenCompra
                var orden = new OrdenCompra
                {
                    IdCliente = req.IdCliente,
                    IdDireccionEnvio = req.IdDireccionEnvio,
                    Estado = string.IsNullOrWhiteSpace(req.Estado) ? "Pagada" : req.Estado,
                    TrackingNumber = req.TrackingNumber ?? "",
                    FechaCreacion = req.FechaCreacion
                };
                _db.OrdenesCompra.Add(orden);
                await _db.SaveChangesAsync();

                // 2) OrdenItems
                foreach (var it in req.Items)
                {
                    if (it.idProducto is null) continue;
                    var oi = new OrdenItem
                    {
                        IdOrden = orden.IdOrden,
                        IdProducto = it.idProducto.Value,
                        Cantidad = it.cantidad,
                        PrecioUnitario = it.precioUnitario
                    };
                    _db.OrdenItems.Add(oi);
                }
                await _db.SaveChangesAsync();

                // 3) Factura (número único)
                var numeroFactura = await GenerateNextInvoiceNumberAsync(req.NumeroFactura);
                var fac = new Factura
                {
                    IdOrden = orden.IdOrden,
                    NumeroFactura = numeroFactura,
                    FechaEmision = req.FechaEmision,
                    Total = req.Total
                };
                _db.Facturas.Add(fac);
                await _db.SaveChangesAsync();

                // 4) FacturaItems
                foreach (var it in req.Items)
                {
                    if (it.idProducto is null) continue;
                    var fi = new FacturaItem
                    {
                        IdFactura = fac.IdFactura,
                        IdProducto = it.idProducto.Value,
                        Cantidad = it.cantidad,
                        PrecioUnitario = it.precioUnitario
                    };
                    _db.FacturaItems.Add(fi);
                }
                await _db.SaveChangesAsync();

                // 5) Pago
                var pago = new Pago
                {
                    IdOrden = orden.IdOrden,
                    IdClienteMetodoPago = mpId.Value,
                    Monto = (double)req.Total,
                    TransaccionRef = "",
                    FechaCreacion = DateTime.UtcNow,
                    Estado = "pagada"
                };
                _db.Pagos.Add(pago);
                await _db.SaveChangesAsync();

                await tx.CommitAsync();

                return Ok(new CrearOrdenResponse
                {
                    IdOrden = orden.IdOrden,
                    IdFactura = fac.IdFactura,
                    IdPago = pago.IdPago,
                    NumeroFactura = numeroFactura
                });
            }
            catch (DbUpdateException ex)
            {
                await tx.RollbackAsync();
                // Devuelve detalle si hay inner exception (SQLite/SQL)
                return StatusCode(500, $"Error al crear la orden: {ex.InnerException?.Message ?? ex.Message}");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return StatusCode(500, $"Error inesperado al crear la orden: {ex.Message}");
            }
        }

        // ========= PUT: descontar stock de productos =========
        [HttpPut("productos/stock")]
        public async Task<IActionResult> DescontarStock([FromBody] List<StockUpdateDto> items)
        {
            if (items == null || items.Count == 0) return BadRequest("Sin items");

            foreach (var it in items)
            {
                var p = await _db.Productos.FirstOrDefaultAsync(x => x.IdProducto == it.IdProducto);
                if (p == null) continue;
                p.Stock = Math.Max(0, p.Stock - it.Cantidad);
            }
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ========= PUT: cerrar carrito =========
        [HttpPut("carrito/cerrar/{idCarrito:int}")]
        public async Task<IActionResult> CerrarCarrito([FromRoute] int idCarrito)
        {
            var c = await _db.Carritos.FirstOrDefaultAsync(x => x.IdCarrito == idCarrito);
            if (c == null) return NotFound("Carrito no encontrado");
            c.Estado = "cerrado"; // según lo que pediste
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
