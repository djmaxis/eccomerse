using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Ecommerce.DAL;
using Ecommerce.DAL.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductosController : ControllerBase
    {
        private readonly AppDbContext _db;
        public ProductosController(AppDbContext db) => _db = db;

        // GET /api/productos?activo=1&maxStock=1&search=iph&skip=0&take=50
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> Get(
            [FromQuery] int? activo = 1,
            [FromQuery] int? maxStock = null,   // ⬅️ antes: = 1
            [FromQuery] string? search = null,
            [FromQuery] int skip = 0,
            [FromQuery] int take = 50)
        {
            if (take <= 0 || take > 200) take = 50;
            if (skip < 0) skip = 0;

            IQueryable<Producto> q = _db.Productos.AsNoTracking();

            if (activo.HasValue)
                q = q.Where(p => p.Activo == (activo.Value == 1));

            // ⬅️ Solo filtra por stock si te pasan maxStock en la URL
            if (maxStock.HasValue)
                q = q.Where(p => p.Stock <= maxStock.Value);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.ToLower();
                q = q.Where(p =>
                    (p.Nombre != null && p.Nombre.ToLower().Contains(term)) ||
                    (p.RefModelo != null && p.RefModelo.ToLower().Contains(term)));
            }

            var data = await q
                .OrderBy(p => p.Nombre)
                .Skip(skip)
                .Take(take)
                .Select(p => new {
                    p.IdProducto,
                    p.RefModelo,
                    p.Nombre,
                    p.Descripcion,
                    p.Precio,
                    p.PrecioOld,
                    p.Stock,
                    Activo = p.Activo ? 1 : 0,
                    FechaCreacion = p.FechaCreacion.ToString("yyyy-MM-dd"),
                    image = p.Image
                })
                .ToListAsync();

            return Ok(data); // o Ok(new { total = await q.CountAsync(), items = data });
        }
      
        // GET /api/productos/{id}
        [HttpGet("{id:int}")]
        public async Task<ActionResult<object>> GetById(int id)
        {
            var p = await _db.Productos.AsNoTracking().FirstOrDefaultAsync(x => x.IdProducto == id);
            if (p == null) return NotFound();

            return Ok(new
            {
                p.IdProducto,
                p.RefModelo,
                p.Nombre,
                p.Descripcion,
                p.Precio,
                p.PrecioOld,
                p.Stock,
                Activo = p.Activo ? 1 : 0,
                FechaCreacion = p.FechaCreacion.ToString("yyyy-MM-dd"),
                image = p.Image
            });
        }
    }
}
