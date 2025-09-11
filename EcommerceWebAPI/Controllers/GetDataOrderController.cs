using System.Text.Json;
using Ecommerce.DAL;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/orders")]
    public class GetDataOrderController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        private static readonly JsonSerializerOptions PrettyJson = new()
        {
            WriteIndented = true
        };

        public GetDataOrderController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        // ---------------------- HELPERS ----------------------
        // ---------------------- HELPERS ----------------------
        private async Task<object> BuildOrdenesPayloadAsync(int idCliente)
        {
            var ordenes = await _db.OrdenesCompra
                .Where(o => o.IdCliente == idCliente)
                .Include(o => o.Items).ThenInclude(oi => oi.Producto)             // Items + Producto
                .Include(o => o.Pagos).ThenInclude(p => p.ClienteMetodoPago)      // Pago + Método de pago
                .Include(o => o.Factura)                                          // Factura
                .Include(o => o.DireccionEnvio)                                   // Dirección de envío
                .OrderByDescending(o => o.IdOrden)
                .Select(o => new
                {
                    // ===== Cabecera
                    o.IdOrden,
                    o.IdCliente,
                    o.Estado,
                    o.TrackingNumber,
                    o.FechaCreacion,

                    // ===== Dirección de envío (completa)
                    Direccion = o.DireccionEnvio == null ? null : new
                    {
                        o.DireccionEnvio.IdDireccion,
                        o.DireccionEnvio.IdCliente,
                        o.DireccionEnvio.Nombre,
                        o.DireccionEnvio.Calle,
                        o.DireccionEnvio.Ciudad,
                        o.DireccionEnvio.Pais,
                        o.DireccionEnvio.CodigoPostal,
                        o.DireccionEnvio.Telefono,
                        o.DireccionEnvio.EsPrincipal
                    },

                    // ===== Factura (si existe)
                    Factura = o.Factura == null ? null : new
                    {
                        o.Factura.IdFactura,
                        o.Factura.NumeroFactura,
                        o.Factura.Total,
                        o.Factura.FechaEmision
                    },

                    // ===== Pago más reciente (si hay varios)
                    Pago = o.Pagos
                        .OrderByDescending(p => p.IdPago)
                        .Select(p => new
                        {
                            p.IdPago,
                            p.Monto,
                            p.Estado,
                            p.Titular,
                            p.RefEnmascarada,
                            p.TransaccionRef,
                            p.FechaCreacion
                        })
                        .FirstOrDefault(),

                    // ===== Método de pago (tabla completa del pago más reciente)
                    MetodoPago = o.Pagos
                        .OrderByDescending(p => p.IdPago)
                        .Select(p => p.ClienteMetodoPago)
                        .Select(mp => new
                        {
                            mp.IdClienteMetodoPago,
                            mp.IdCliente,
                            mp.Nombre,
                            mp.Tipo,            // 'tarjeta' | 'paypal'
                            mp.NumeroTarjeta,
                            mp.cvv,
                            mp.ExpMes,
                            mp.ExpAnio,
                            mp.Email,
                            mp.EsPrincipal
                        })
                        .FirstOrDefault(),

                    // ===== Items
                    Items = o.Items.Select(oi => new
                    {
                        oi.IdOrdenItem,
                        oi.IdOrden,
                        oi.IdProducto,
                        Nombre = oi.Producto != null ? oi.Producto.Nombre : null,
                        oi.Cantidad,
                        oi.PrecioUnitario,
                        Producto = oi.Producto == null ? null : new
                        {
                            oi.Producto.RefModelo,
                            oi.Producto.Image
                        }
                    }).ToList()
                })
                .ToListAsync();

            return new
            {
                clienteId = idCliente,
                ordenes
            };
        }


        // ---------------------- GETs (rutas equivalentes) ----------------------

        // GET /api/orders/ordenes/cliente/2
        [HttpGet("ordenes/cliente/{idCliente:int}")]
        public async Task<IActionResult> GetOrdenesPorClienteA([FromRoute] int idCliente)
            => Ok(await BuildOrdenesPayloadAsync(idCliente));

        // GET /api/orders/cliente/2/ordenes
        [HttpGet("cliente/{idCliente:int}/ordenes")]
        public async Task<IActionResult> GetOrdenesPorClienteB([FromRoute] int idCliente)
            => Ok(await BuildOrdenesPayloadAsync(idCliente));

        // GET /api/orders/ordenes?clienteId=2
        [HttpGet("ordenes")]
        public async Task<IActionResult> GetOrdenesPorClienteC([FromQuery] int clienteId)
            => Ok(await BuildOrdenesPayloadAsync(clienteId));

        // ---------------------- POST: guarda JSON en /wwwroot/js/orders/get_data_orders.json ----------------------

        // POST /api/orders/json
        [HttpPost("json")]
        public async Task<IActionResult> SaveOrdersJson([FromBody] object payload)
        {
            try
            {
                var webroot = _env.WebRootPath ?? Path.Combine(AppContext.BaseDirectory, "wwwroot");
                var dir = Path.Combine(webroot, "js", "orders");
                Directory.CreateDirectory(dir);

                var filePath = Path.Combine(dir, "get_data_orders.json");
                var json = JsonSerializer.Serialize(payload, PrettyJson);
                await System.IO.File.WriteAllTextAsync(filePath, json);

                return Ok(new
                {
                    saved = true,
                    webPath = "/js/orders/get_data_orders.json",
                    physicalPath = filePath
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"No se pudo guardar get_data_orders.json: {ex.Message}");
            }
        }
    }
}
