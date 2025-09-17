// Controllers/CancelarController.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Ecommerce.DAL;
using Ecommerce.DAL.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/orders")]
    public class CancelarController : ControllerBase
    {
        private readonly AppDbContext _db;

        public CancelarController(AppDbContext db) { _db = db; }

        // PUT: /api/orders/orden/{idOrden}/cancelar
        [HttpPut("orden/{idOrden:int}/cancelar")]
        public async Task<IActionResult> CancelarOrden([FromRoute] int idOrden)
        {
            // Traemos la orden con sus items y pagos
            var orden = await _db.OrdenesCompra
                .Include(o => o.Items)
                .Include(o => o.Pagos)
                .FirstOrDefaultAsync(o => o.IdOrden == idOrden);

            if (orden == null) return NotFound(new { message = "Orden no encontrada." });

            // ===== Validaciones de estado =====
            var estado = (orden.Estado ?? "").Trim();
            if (estado.Equals("Enviada", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "No puedes cancelar una orden enviada" });
            if (estado.Equals("Completada", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "No puede cancelar una orden completada" });
            if (estado.Equals("Cancelada", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "No puede enviar una orden cancelada" });
            if (!estado.Equals("Pagada", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Solo puedes cancelar órdenes en estado Pagada." });

            // ===== Validación de antigüedad (30 días) =====
            var fecha = orden.FechaCreacion; // almacenada en UTC al crear orden
            var ahora = DateTime.UtcNow;
            var dias = (ahora - fecha).TotalDays;
            if (dias > 30.0)
                return BadRequest(new { message = "No puedes cancelar una orden con mas de 30 dias." });

            // ===== Cancelación + Reposición de stock =====
            using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                // 1) Marcar orden
                orden.Estado = "Cancelada";
                _db.OrdenesCompra.Update(orden);

                // 2) Marcar último pago (si existe)
                var pago = await _db.Pagos
                    .Where(p => p.IdOrden == idOrden)
                    .OrderByDescending(p => p.IdPago)
                    .FirstOrDefaultAsync();

                if (pago != null)
                {
                    pago.Estado = "Cancelada";
                    _db.Pagos.Update(pago);
                }

                // 3) Reponer stock (inverso a descontar stock en PostPutController)
                //    p.Stock = p.Stock + Cantidad (sin techo; asume consistencia)
                var itemIds = orden.Items.Select(i => i.IdProducto).ToList();
                var productos = await _db.Productos
                    .Where(p => itemIds.Contains(p.IdProducto))
                    .ToListAsync();

                foreach (var it in orden.Items)
                {
                    var prod = productos.FirstOrDefault(p => p.IdProducto == it.IdProducto);
                    if (prod != null)
                    {
                        checked
                        {
                            prod.Stock = prod.Stock + it.Cantidad;
                        }
                        _db.Productos.Update(prod);
                    }
                }

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return Ok(new
                {
                    message = "Orden cancelada y stock repuesto.",
                    IdOrden = orden.IdOrden,
                    Estado = orden.Estado
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return StatusCode(500, new { message = "Error al cancelar la orden.", detail = ex.Message });
            }
        }
    }
}
