using Ecommerce.DAL;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProdMasVendidosController : ControllerBase
{
    private readonly AppDbContext _db;
    public ProdMasVendidosController(AppDbContext db) => _db = db;

    /// <summary>
    /// Devuelve registros de ProdMasVendidos en los últimos {days} días.
    /// GET /api/prodmasvendidos?days=360&take=50
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int days = 360, [FromQuery] int take = 50, CancellationToken ct = default)
    {
        if (days <= 0) days = 360;
        if (take <= 0 || take > 500) take = 50;

        var since = DateTime.UtcNow.Date.AddDays(-days);

        var query = _db.ProdMasVendidos
            .AsNoTracking()
            .Where(p => p.FechaProdVenta >= since)
            .OrderByDescending(p => p.Cant)
            .ThenByDescending(p => p.FechaProdVenta)
            .Select(p => new {
                p.IdPMV,
                p.IdProducto,
                p.Nombre,
                FechaProdVenta = p.FechaProdVenta, // ISO 8601
                p.Cant
            })
            .Take(take);

        var list = await query.ToListAsync(ct);
        return Ok(list);
    }
}
