// EcommerceWebAPI/Controllers/ClientesController.cs
using Ecommerce.DAL;
using Ecommerce.DAL.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ClientesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ClientesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/clientes/5
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetCliente(int id)
        {
            var cli = await _context.Clientes
                        .AsNoTracking()
                        .FirstOrDefaultAsync(c => c.IdCliente == id);
            if (cli is null) return NotFound();
            return Ok(cli);
        }

        // PATCH: api/clientes/5/nombre
        public class PatchNombreDto { public string? Nombre { get; set; } }

        [HttpPatch("{id:int}/nombre")]
        public async Task<IActionResult> PatchNombre(int id, [FromBody] PatchNombreDto dto)
        {
            if (dto is null || string.IsNullOrWhiteSpace(dto.Nombre))
                return BadRequest("Nombre requerido.");

            var nombre = dto.Nombre.Trim();
            if (nombre.Length <= 3)
                return BadRequest("El nombre debe tener más de 3 caracteres.");

            var cli = await _context.Clientes.FirstOrDefaultAsync(c => c.IdCliente == id);
            if (cli is null) return NotFound();

            cli.Nombre = nombre;
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Nombre actualizado.", cli.IdCliente, cli.Nombre });
        }

        // PUT: api/clientes/5
        [HttpPut("{id:int}")]
        public async Task<IActionResult> PutCliente(int id, [FromBody] Cliente model)
        {
            if (model is null) return BadRequest("Payload inválido.");
            if (id != model.IdCliente) return BadRequest("El Id no coincide.");

            // Normaliza/valida
            model.Nombre = (model.Nombre ?? string.Empty).Trim();
            model.Correo = (model.Correo ?? string.Empty).Trim();

            if (model.Nombre.Length <= 3)
                return BadRequest("El nombre debe tener más de 3 caracteres.");

            if (string.IsNullOrWhiteSpace(model.Correo) || !model.Correo.Contains("@"))
                return BadRequest("Correo inválido.");

            // Solo actualiza campos permitidos:
            var cli = await _context.Clientes.FirstOrDefaultAsync(c => c.IdCliente == id);
            if (cli is null) return NotFound();

            cli.Nombre = model.Nombre;
            cli.Correo = model.Correo;
            if (!string.IsNullOrWhiteSpace(model.Contrasena))
                cli.Contrasena = model.Contrasena;   // opcional: o no permitir aquí
                                                     // No toques FechaRegistro si no quieres
            cli.Activo = model.Activo;

            await _context.SaveChangesAsync();
            return Ok(new { mensaje = "Cliente actualizado.", cli.IdCliente, cli.Nombre, cli.Correo });
        }

        // POST ya lo tienes (lo dejo igual)
        [HttpPost]
        public async Task<IActionResult> PostCliente([FromBody] Cliente cliente)
        {
            if (cliente is null)
                return BadRequest("Payload inválido.");

            if (string.IsNullOrWhiteSpace(cliente.Nombre) || cliente.Nombre.Trim().Length <= 3)
                return BadRequest("El nombre debe tener más de 3 caracteres.");

            if (string.IsNullOrWhiteSpace(cliente.Correo) || !cliente.Correo.Contains("@"))
                return BadRequest("El correo no es válido.");

            if (string.IsNullOrWhiteSpace(cliente.Contrasena))
                return BadRequest("La contraseña es obligatoria.");

            var existe = await _context.Clientes.AnyAsync(c => c.Correo == cliente.Correo);
            if (existe)
                return Conflict("El correo ya está registrado.");

            cliente.Nombre = cliente.Nombre.Trim();
            cliente.Correo = cliente.Correo.Trim();
            cliente.FechaRegistro = DateTime.UtcNow;
            cliente.Activo = true;

            _context.Clientes.Add(cliente);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Cliente creado con éxito",
                cliente.IdCliente,
                cliente.Nombre,
                cliente.Correo
            });
        }
    }
}
