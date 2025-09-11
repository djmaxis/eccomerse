using Ecommerce.DAL;
using Ecommerce.DAL.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DireccionesController : ControllerBase
    {
        private readonly AppDbContext _context;
        public DireccionesController(AppDbContext context) { _context = context; }

        // GET: api/direcciones?clienteId=5
        [HttpGet]
        public async Task<IActionResult> GetByCliente([FromQuery] int clienteId)
        {
            if (clienteId <= 0) return BadRequest("clienteId requerido.");
            var list = await _context.Direcciones
                            .AsNoTracking()
                            .Where(d => d.IdCliente == clienteId)
                            .OrderByDescending(d => d.EsPrincipal)
                            .ThenBy(d => d.IdDireccion)
                            .ToListAsync();
            return Ok(list);
        }

        // GET: api/direcciones/10
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var dir = await _context.Direcciones.AsNoTracking()
                           .FirstOrDefaultAsync(d => d.IdDireccion == id);
            return dir is null ? NotFound() : Ok(dir);
        }

        public class DireccionDto
        {
            public int? IdDireccion { get; set; }
            public int IdCliente { get; set; }
            public string Nombre { get; set; } = null!;
            public string Calle { get; set; } = null!;
            public string Pais { get; set; } = null!;
            public string Ciudad { get; set; } = null!;
            public string? CodigoPostal { get; set; }
            public string? Telefono { get; set; }
            public bool EsPrincipal { get; set; }
        }

        // POST: api/direcciones
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] DireccionDto dto)
        {
            var (ok, msg) = Validar(dto);
            if (!ok) return BadRequest(msg);

            var entity = new Direccion
            {
                IdCliente = dto.IdCliente,
                Nombre = dto.Nombre.Trim(),
                Calle = dto.Calle.Trim(),
                Pais = dto.Pais.Trim(),
                Ciudad = dto.Ciudad.Trim(),
                CodigoPostal = dto.CodigoPostal?.Trim(),
                Telefono = dto.Telefono?.Trim(),
                EsPrincipal = dto.EsPrincipal
            };

            using var tx = await _context.Database.BeginTransactionAsync();
            if (entity.EsPrincipal)
            {
                await _context.Direcciones
                    .Where(d => d.IdCliente == entity.IdCliente && d.EsPrincipal)
                    .ExecuteUpdateAsync(s => s.SetProperty(d => d.EsPrincipal, false));
            }

            _context.Direcciones.Add(entity);
            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(entity);
        }

        // PUT: api/direcciones/10
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Put(int id, [FromBody] DireccionDto dto)
        {
            if (dto.IdDireccion is null || dto.IdDireccion.Value != id)
                return BadRequest("Id no coincide.");

            var (ok, msg) = Validar(dto);
            if (!ok) return BadRequest(msg);

            var entity = await _context.Direcciones.FirstOrDefaultAsync(d => d.IdDireccion == id);
            if (entity is null) return NotFound();

            entity.Nombre = dto.Nombre.Trim();
            entity.Calle = dto.Calle.Trim();
            entity.Pais = dto.Pais.Trim();
            entity.Ciudad = dto.Ciudad.Trim();
            entity.CodigoPostal = dto.CodigoPostal?.Trim();
            entity.Telefono = dto.Telefono?.Trim();

            using var tx = await _context.Database.BeginTransactionAsync();
            if (dto.EsPrincipal && !entity.EsPrincipal)
            {
                await _context.Direcciones
                    .Where(d => d.IdCliente == entity.IdCliente && d.EsPrincipal)
                    .ExecuteUpdateAsync(s => s.SetProperty(d => d.EsPrincipal, false));
                entity.EsPrincipal = true;
            }
            else
            {
                entity.EsPrincipal = dto.EsPrincipal;
            }

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(entity);
        }

        // PATCH: api/direcciones/10/principal
        [HttpPatch("{id:int}/principal")]
        public async Task<IActionResult> SetPrincipal(int id)
        {
            var entity = await _context.Direcciones.FirstOrDefaultAsync(d => d.IdDireccion == id);
            if (entity is null) return NotFound();

            using var tx = await _context.Database.BeginTransactionAsync();
            await _context.Direcciones
                .Where(d => d.IdCliente == entity.IdCliente && d.EsPrincipal)
                .ExecuteUpdateAsync(s => s.SetProperty(d => d.EsPrincipal, false));
            entity.EsPrincipal = true;
            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(entity);
        }

        // DELETE: api/direcciones/10
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var entity = await _context.Direcciones.FirstOrDefaultAsync(d => d.IdDireccion == id);
            if (entity is null) return NotFound();

            _context.Direcciones.Remove(entity);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static (bool ok, string? msg) Validar(DireccionDto d)
        {
            if (d.IdCliente <= 0) return (false, "IdCliente requerido.");
            if (string.IsNullOrWhiteSpace(d.Nombre) || d.Nombre.Trim().Length < 3) return (false, "Nombre inválido.");
            if (string.IsNullOrWhiteSpace(d.Calle)) return (false, "Calle requerida.");
            if (string.IsNullOrWhiteSpace(d.Pais)) return (false, "País requerido.");
            if (string.IsNullOrWhiteSpace(d.Ciudad)) return (false, "Ciudad requerida.");
            return (true, null);
        }
    }
}
