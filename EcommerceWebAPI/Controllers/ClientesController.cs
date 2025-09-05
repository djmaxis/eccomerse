// EcommerceWebAPI/Controllers/ClientesController.cs
using Ecommerce.DAL;               // <-- Importa el DbContext real
using Ecommerce.DAL.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcommerceWebAPI.Controllers  // <-- Unifica namespace con el resto de controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ClientesController : ControllerBase
    {
        private readonly AppDbContext _context; // <-- Usa AppDbContext

        public ClientesController(AppDbContext context) // <-- Inyecta AppDbContext
        {
            _context = context;
        }

        // POST: api/clientes
        [HttpPost]
        public async Task<IActionResult> PostCliente([FromBody] Cliente cliente)
        {
            if (cliente is null)
                return BadRequest("Payload inválido.");

            if (string.IsNullOrWhiteSpace(cliente.Nombre) || cliente.Nombre.Length < 3)
                return BadRequest("El nombre debe tener al menos 3 caracteres.");

            if (string.IsNullOrWhiteSpace(cliente.Correo) || !cliente.Correo.Contains("@"))
                return BadRequest("El correo no es válido.");

            if (string.IsNullOrWhiteSpace(cliente.Contrasena))
                return BadRequest("La contraseña es obligatoria.");

            // ¿Correo ya existe?
            var existe = await _context.Clientes.AnyAsync(c => c.Correo == cliente.Correo);
            if (existe)
                return Conflict("El correo ya está registrado.");

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
