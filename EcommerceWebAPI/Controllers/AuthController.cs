using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Ecommerce.DAL;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Ajusta el namespace a tu proyecto
namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;

        public AuthController(AppDbContext db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        // ===== DTOs =====
        public class LoginRequest
        {
            public string Correo { get; set; } = string.Empty;
            public string Contrasena { get; set; } = string.Empty;
        }

        // ===== Endpoints =====

        /// <summary>
        /// Login por JSON (SPA). Devuelve token JWT + datos básicos + rol.
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest body)
        {
            if (string.IsNullOrWhiteSpace(body?.Correo) || string.IsNullOrWhiteSpace(body?.Contrasena))
                return BadRequest(new { message = "Completa correo y contraseña." });

            var correo = body.Correo.Trim().ToLower();

            var user = await _db.Clientes
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Correo.ToLower() == correo);

            if (user == null)
                return Unauthorized(new { message = "Credenciales inválidas." });

            // Verifica contraseña: si empieza con prefijo de BCrypt, verifica hash; de lo contrario, texto plano.
            if (!VerifyPassword(body.Contrasena, user.Contrasena))
                return Unauthorized(new { message = "Credenciales inválidas." });

            // Rol por defecto si no estuviera definido
            var rol = string.IsNullOrWhiteSpace(user.Rol) ? "cliente" : user.Rol;

            var token = CreateJwt(
                idCliente: user.IdCliente,
                nombre: user.Nombre ?? string.Empty,
                correo: user.Correo ?? string.Empty,
                rol: rol
            );

            return Ok(new
            {
                token,
                idCliente = user.IdCliente,
                nombre = user.Nombre,
                correo = user.Correo,
                rol
            });
        }

        /// <summary>
        /// Variante para formularios tradicionales: redirige a admin.html o index.html desde backend.
        /// Útil si NO quieres lógica de redirección en el front.
        /// </summary>
        [HttpPost("login-form")]
        public async Task<IActionResult> LoginForm([FromForm] LoginRequest body)
        {
            if (string.IsNullOrWhiteSpace(body?.Correo) || string.IsNullOrWhiteSpace(body?.Contrasena))
                return Redirect("/login.html?e=1");

            var correo = body.Correo.Trim().ToLower();
            var user = await _db.Clientes.AsNoTracking().FirstOrDefaultAsync(c => c.Correo.ToLower() == correo);
            if (user == null || !VerifyPassword(body.Contrasena, user.Contrasena))
                return Redirect("/login.html?e=2");

            var rol = string.IsNullOrWhiteSpace(user.Rol) ? "cliente" : user.Rol;
            var token = CreateJwt(user.IdCliente, user.Nombre ?? "", user.Correo ?? "", rol);

            // Entrega el token al front via fragmento (o cookie si prefieres cookie-based auth)
            // Aquí devolvemos una página mínima que guarda el token y redirige:
            var html = $@"<!DOCTYPE html>
<html><head><meta charset='utf-8'><title>Ingresando…</title></head>
<body>
<script>
  localStorage.setItem('token', '{token}');
  localStorage.setItem('clienteId', '{user.IdCliente}');
  localStorage.setItem('nombre', {System.Text.Json.JsonSerializer.Serialize(user.Nombre ?? "")});
  localStorage.setItem('correo', {System.Text.Json.JsonSerializer.Serialize(user.Correo ?? "")});
  location.href = {(rol.Equals("admin", StringComparison.OrdinalIgnoreCase) ? "'/admin.html'" : "'/index.html'")};
</script>
</body></html>";
            return Content(html, "text/html; charset=utf-8");
        }

        /// <summary>
        /// Info del usuario autenticado (requiere Authorization: Bearer ...).
        /// </summary>
        [Authorize]
        [HttpGet("me")]
        public IActionResult Me()
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub")?.Value;
            var name = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirst("name")?.Value;
            var mail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirst("email")?.Value;
            var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirst("role")?.Value;

            return Ok(new { id, nombre = name, correo = mail, rol = role });
        }

        // ===== Helpers =====

        /// <summary>
        /// Verifica contraseña: BCrypt si el guardado parece hash; si no, texto plano.
        /// </summary>
        private static bool VerifyPassword(string plain, string? stored)
        {
            var s = stored ?? string.Empty;
            if (string.IsNullOrEmpty(s)) return false;

            // Prefijos típicos de BCrypt: $2a$, $2b$, $2y$
            if (s.StartsWith("$2a$") || s.StartsWith("$2b$") || s.StartsWith("$2y$"))
            {
                try { return BCrypt.Net.BCrypt.Verify(plain, s); }
                catch { return false; }
            }

            // Fallback a texto plano (si aún no migras a hash)
            return plain == s;
        }

        /// <summary>
        /// Crea el JWT con claim de rol.
        /// Requiere appsettings (o variables de entorno):
        /// Jwt:Key, Jwt:Issuer, Jwt:Audience, Jwt:ExpireMinutes
        /// </summary>
        private string CreateJwt(int idCliente, string nombre, string correo, string rol)
        {
            var key = _config["Jwt:Key"] ?? throw new InvalidOperationException("Config Jwt:Key ausente");
            var issuer = _config["Jwt:Issuer"] ?? "eev.store";
            var audience = _config["Jwt:Audience"] ?? "eev.store.web";
            var minutes = int.TryParse(_config["Jwt:ExpireMinutes"], out var m) ? m : 120;

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, idCliente.ToString()),
                new(ClaimTypes.Name, nombre),
                new(ClaimTypes.Email, correo),
                new(ClaimTypes.Role, string.IsNullOrWhiteSpace(rol) ? "cliente" : rol),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
            var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(minutes),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
