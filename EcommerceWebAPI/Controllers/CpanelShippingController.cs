using Ecommerce.DAL;                 // <-- Tu namespace del DbContext
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/shipping")]
    [Produces("application/json")]
    public class CpanelShippingController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<CpanelShippingController> _logger;

        public CpanelShippingController(AppDbContext db, ILogger<CpanelShippingController> logger)
        {
            _db = db;
            _logger = logger;
        }

        // Ej: ORD-2025-09-16#00000031
        private static string MaskOrder(int id, DateTime fecha)
            => $"ORD-{fecha:yyyy-MM-dd}#{id.ToString().PadLeft(8, '0')}";

        // Intenta extraer el IdOrden desde la máscara o acepta número suelto (con o sin ceros)
        private static bool TryExtractIdFromMask(string q, out int id)
        {
            id = 0;
            if (string.IsNullOrWhiteSpace(q)) return false;
            var s = q.Trim();

            var hash = s.IndexOf('#');
            if (s.StartsWith("ORD-", StringComparison.OrdinalIgnoreCase) && hash >= 0 && hash < s.Length - 1)
            {
                var tail = s[(hash + 1)..];
                if (int.TryParse(tail, out var parsed))
                {
                    id = parsed;
                    return true;
                }
            }
            // Si escribió solo el número (con o sin ceros a la izquierda)
            if (int.TryParse(s, out var id2))
            {
                id = id2;
                return true;
            }
            return false;
        }

        // ========== GET: Pendientes (Estado = Pagada) ==========
        // GET /api/shipping/pending?q=&take=50
        [HttpGet("pending")]
        public async Task<IActionResult> GetPendientes([FromQuery] string? q = null, [FromQuery] int take = 50)
        {
            try
            {
                take = Math.Max(1, Math.Min(take, 500));
                _logger.LogInformation("GET pending q={Q} take={Take}", q, take);

                var baseQuery = _db.OrdenesCompra
                    .AsNoTracking()
                    .Include(o => o.Cliente)
                    .Where(o => o.Estado == "Pagada");

                if (!string.IsNullOrWhiteSpace(q))
                {
                    if (TryExtractIdFromMask(q, out var idFromMask))
                    {
                        baseQuery = baseQuery.Where(o => o.IdOrden == idFromMask);
                    }
                    else
                    {
                        // Búsqueda estricta por número; si no hay número, no filtra por otros campos
                        baseQuery = baseQuery.Where(o => EF.Functions.Like(o.IdOrden.ToString(), $"%{q}%"));
                    }
                }

                var list = await baseQuery
                    .OrderByDescending(o => o.IdOrden)
                    .Take(take)
                    .Select(o => new
                    {
                        idEstatusOrden = o.IdOrden, // Alias si no usas tabla EstatusOrden
                        idOrden = o.IdOrden,
                        noOrden = MaskOrder(o.IdOrden, o.FechaCreacion),
                        cliente = o.Cliente.Correo ?? o.Cliente.Nombre,
                        fecha = o.FechaCreacion.ToString("dd/MM/yyyy"),
                        estatus = o.Estado
                    })
                    .ToListAsync();

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GET /api/shipping/pending");
                return StatusCode(500, "Error interno al obtener pendientes.");
            }
        }

        // ========== GET: Enviadas (Estado = Enviada) ==========
        // GET /api/shipping/shipped?q=&take=50
        [HttpGet("shipped")]
        public async Task<IActionResult> GetEnviadas([FromQuery] string? q = null, [FromQuery] int take = 50)
        {
            try
            {
                take = Math.Max(1, Math.Min(take, 500));
                _logger.LogInformation("GET shipped q={Q} take={Take}", q, take);

                var baseQuery = _db.OrdenesCompra
                    .AsNoTracking()
                    .Include(o => o.Cliente)
                    .Where(o => o.Estado == "Enviada");

                if (!string.IsNullOrWhiteSpace(q))
                {
                    if (TryExtractIdFromMask(q, out var idFromMask))
                    {
                        baseQuery = baseQuery.Where(o => o.IdOrden == idFromMask);
                    }
                    else
                    {
                        baseQuery = baseQuery.Where(o => EF.Functions.Like(o.IdOrden.ToString(), $"%{q}%"));
                    }
                }

                var list = await baseQuery
                    .OrderByDescending(o => o.IdOrden)
                    .Take(take)
                    .Select(o => new
                    {
                        idEstatusOrden = o.IdOrden,
                        idOrden = o.IdOrden,
                        noOrden = MaskOrder(o.IdOrden, o.FechaCreacion),
                        cliente = o.Cliente.Correo ?? o.Cliente.Nombre,
                        fecha = o.FechaCreacion.ToString("dd/MM/yyyy"),
                        estatus = o.Estado,
                        tracking = o.TrackingNumber
                    })
                    .ToListAsync();

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GET /api/shipping/shipped");
                return StatusCode(500, "Error interno al obtener enviadas.");
            }
        }

        public class TrackingBody
        {
            public string? Tracking { get; set; }
            public string? Estatus { get; set; } // opcional: mover de Pagada -> Enviada, etc.
        }

        // ========== POST: Añadir tracking (típico desde pendientes; mueve a Enviada) ==========
        // POST /api/shipping/{id}/tracking
        [HttpPost("{id:int}/tracking")]
        public async Task<IActionResult> AddTracking([FromRoute] int id, [FromBody] TrackingBody body)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(body?.Tracking))
                    return BadRequest("Tracking requerido.");

                var orden = await _db.OrdenesCompra.FirstOrDefaultAsync(o => o.IdOrden == id);
                if (orden == null) return NotFound("Orden no encontrada.");

                orden.TrackingNumber = body.Tracking.Trim();
                orden.Estado = string.IsNullOrWhiteSpace(body.Estatus) ? "Enviada" : body.Estatus!.Trim();

                await _db.SaveChangesAsync();
                _logger.LogInformation("AddTracking OK: IdOrden={Id}, Tracking={Tracking}, NuevoEstado={Estado}", id, orden.TrackingNumber, orden.Estado);
                return Ok(new { ok = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en POST /api/shipping/{id}/tracking Id={Id}", id);
                return StatusCode(500, "No se pudo guardar el tracking.");
            }
        }

        // ========== PUT: Actualizar tracking (típico desde enviadas) ==========
        // PUT /api/shipping/{id}/tracking
        [HttpPut("{id:int}/tracking")]
        public async Task<IActionResult> UpdateTracking([FromRoute] int id, [FromBody] TrackingBody body)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(body?.Tracking))
                    return BadRequest("Tracking requerido.");

                var orden = await _db.OrdenesCompra.FirstOrDefaultAsync(o => o.IdOrden == id);
                if (orden == null) return NotFound("Orden no encontrada.");

                orden.TrackingNumber = body.Tracking.Trim();
                if (!string.IsNullOrWhiteSpace(body.Estatus))
                    orden.Estado = body.Estatus!.Trim();

                await _db.SaveChangesAsync();
                _logger.LogInformation("UpdateTracking OK: IdOrden={Id}, Tracking={Tracking}, Estado={Estado}", id, orden.TrackingNumber, orden.Estado);
                return Ok(new { ok = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en PUT /api/shipping/{id}/tracking Id={Id}", id);
                return StatusCode(500, "No se pudo actualizar el tracking.");
            }
        }
    }
}
