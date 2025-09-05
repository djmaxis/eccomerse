using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Ecommerce.BLL.DTOs;
using Ecommerce.BLL.Interfaces;
using Ecommerce.DAL;
using Ecommerce.DAL.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Ecommerce.BLL.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;

        public AuthService(AppDbContext db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        public async Task<AuthResultDto> RegisterAsync(RegisterDto dto)
        {
            var exists = await _db.Clientes.AnyAsync(c => c.Correo == dto.Correo);
            if (exists)
                throw new InvalidOperationException("El correo ya está registrado.");

            var cli = new Cliente
            {
                Nombre = dto.Nombre,
                Correo = dto.Correo,
                Contrasena = dto.Contrasena, // ⚠️ texto plano (demo)
                FechaRegistro = DateTime.UtcNow,
                Activo = true
            };

            _db.Clientes.Add(cli);
            await _db.SaveChangesAsync();

            return new AuthResultDto
            {
                Token = GenerateJwt(cli),
                Nombre = cli.Nombre,
                Correo = cli.Correo
            };
        }

        public async Task<AuthResultDto> LoginAsync(LoginDto dto)
        {
            var cli = await _db.Clientes.SingleOrDefaultAsync(c => c.Correo == dto.Correo && c.Activo);
            if (cli is null || cli.Contrasena != dto.Contrasena)
                throw new UnauthorizedAccessException("Credenciales inválidas.");

            return new AuthResultDto
            {
                Token = GenerateJwt(cli),
                Nombre = cli.Nombre,
                Correo = cli.Correo
            };
        }

        private string GenerateJwt(Cliente c)
        {
            var keyStr = _config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key no configurado.");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, c.IdCliente.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, c.Correo),
                new Claim("name", c.Nombre)
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
