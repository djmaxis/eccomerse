// Controllers/MetodoPagoController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using System.Data;
using System.Text.Json;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/clientes/{clienteId:int}/metodos-pago")]
    public class MetodoPagoController : ControllerBase
    {
        private readonly IConfiguration _config;
        public MetodoPagoController(IConfiguration config)
        {
            _config = config;
        }

        private string ConnStr =>
            _config.GetConnectionString("Default") ?? "Data Source=ecommerce.db";

        // DTO que refleja tu tabla real
        public class MetodoPagoDto
        {
            public int IdClienteMetodoPago { get; set; }
            public int IdCliente { get; set; }
            public string Nombre { get; set; } = null!;
            public string Tipo { get; set; } = null!; // 'tarjeta' | 'paypal'
            public string? NumeroTarjeta { get; set; }
            public string? cvv { get; set; }
            public int? ExpMes { get; set; }
            public int? ExpAnio { get; set; }
            public string? Email { get; set; }
            public bool EsPrincipal { get; set; }
        }

        // Helper: enmascarar tarjeta en respuesta
        private static string MaskCard(string? card)
        {
            var digits = new string((card ?? "").Where(char.IsDigit).ToArray());
            if (string.IsNullOrEmpty(digits)) return "";
            var last4 = digits.Length >= 4 ? digits[^4..] : digits;
            return $"•••• •••• •••• {last4}";
        }

        private static bool IsValidTipo(string? tipo) =>
            string.Equals(tipo, "tarjeta", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(tipo, "paypal", StringComparison.OrdinalIgnoreCase);

        // GET: /api/clientes/{clienteId}/metodos-pago
        [HttpGet]
        public async Task<IActionResult> List(int clienteId)
        {
            using var conn = new SqliteConnection(ConnStr);
            await conn.OpenAsync();

            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
SELECT IdClienteMetodoPago, IdCliente, Nombre, Tipo, NumeroTarjeta, cvv, ExpMes, ExpAnio, Email, EsPrincipal
FROM ClienteMetodoPago
WHERE IdCliente = $id
ORDER BY EsPrincipal DESC, IdClienteMetodoPago DESC;";
            cmd.Parameters.AddWithValue("$id", clienteId);

            var list = new List<MetodoPagoDto>();
            using var rd = await cmd.ExecuteReaderAsync();
            while (await rd.ReadAsync())
            {
                list.Add(new MetodoPagoDto
                {
                    IdClienteMetodoPago = rd.GetInt32(0),
                    IdCliente = rd.GetInt32(1),
                    Nombre = rd.GetString(2),
                    Tipo = rd.GetString(3),
                    NumeroTarjeta = rd.IsDBNull(4) ? null : rd.GetString(4),
                    cvv = null, // JAMÁS devolvemos cvv
                    ExpMes = rd.IsDBNull(6) ? (int?)null : rd.GetInt32(6),
                    ExpAnio = rd.IsDBNull(7) ? (int?)null : rd.GetInt32(7),
                    Email = rd.IsDBNull(8) ? null : rd.GetString(8),
                    EsPrincipal = !rd.IsDBNull(9) && rd.GetInt32(9) == 1
                });
            }

            // Enmascarar número en output
            foreach (var m in list)
                if (string.Equals(m.Tipo, "tarjeta", StringComparison.OrdinalIgnoreCase))
                    m.NumeroTarjeta = MaskCard(m.NumeroTarjeta);

            return Ok(list);
        }

        // POST: /api/clientes/{clienteId}/metodos-pago
        [HttpPost]
        public async Task<IActionResult> Create(int clienteId, [FromBody] MetodoPagoDto input)
        {
            if (!IsValidTipo(input.Tipo)) return BadRequest(new { message = "Tipo inválido (tarjeta|paypal)." });
            if (string.IsNullOrWhiteSpace(input.Nombre) || input.Nombre.Trim().Length < 3)
                return BadRequest(new { message = "Nombre/Alias es obligatorio (mín. 3)." });

            if (string.Equals(input.Tipo, "tarjeta", StringComparison.OrdinalIgnoreCase))
            {
                var digits = new string((input.NumeroTarjeta ?? "").Where(char.IsDigit).ToArray());
                if (digits.Length < 15) return BadRequest(new { message = "Número de tarjeta inválido (mín. 15 dígitos)." });
                if (string.IsNullOrWhiteSpace(input.cvv) || input.cvv!.Length < 3)
                    return BadRequest(new { message = "CVV inválido (3-4 dígitos)." });
                if (input.ExpMes is null || input.ExpMes < 1 || input.ExpMes > 12)
                    return BadRequest(new { message = "ExpMes inválido (1-12)." });
                if (input.ExpAnio is null || input.ExpAnio < 0)
                    return BadRequest(new { message = "ExpAnio inválido." });
                input.NumeroTarjeta = digits;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(input.Email) || !input.Email.Contains("@"))
                    return BadRequest(new { message = "Email PayPal inválido." });
                input.NumeroTarjeta = null;
                input.cvv = null;
                input.ExpMes = null;
                input.ExpAnio = null;
            }

            using var conn = new SqliteConnection(ConnStr);
            await conn.OpenAsync();

            // Desmarcar otros "principal" si este entra como principal
            if (input.EsPrincipal)
            {
                var updPrincipal = conn.CreateCommand();
                updPrincipal.CommandText = @"UPDATE ClienteMetodoPago SET EsPrincipal = 0 WHERE IdCliente = $c;";
                updPrincipal.Parameters.AddWithValue("$c", clienteId);
                await updPrincipal.ExecuteNonQueryAsync();
            }

            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
INSERT INTO ClienteMetodoPago (IdCliente, Nombre, Tipo, NumeroTarjeta, cvv, ExpMes, ExpAnio, Email, EsPrincipal)
VALUES ($IdCliente, $Nombre, $Tipo, $NumeroTarjeta, $cvv, $ExpMes, $ExpAnio, $Email, $EsPrincipal);
SELECT last_insert_rowid();";
            cmd.Parameters.AddWithValue("$IdCliente", clienteId);
            cmd.Parameters.AddWithValue("$Nombre", input.Nombre.Trim());
            cmd.Parameters.AddWithValue("$Tipo", input.Tipo.Trim().ToLowerInvariant());
            cmd.Parameters.AddWithValue("$NumeroTarjeta", (object?)input.NumeroTarjeta ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$cvv", (object?)input.cvv ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ExpMes", (object?)input.ExpMes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ExpAnio", (object?)input.ExpAnio ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$Email", (object?)input.Email ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$EsPrincipal", input.EsPrincipal ? 1 : 0);

            var newId = (long)await cmd.ExecuteScalarAsync();

            // Devolver objeto creado (enmascarado)
            input.IdClienteMetodoPago = (int)newId;
            input.IdCliente = clienteId;
            if (string.Equals(input.Tipo, "tarjeta", StringComparison.OrdinalIgnoreCase))
                input.NumeroTarjeta = MaskCard(input.NumeroTarjeta);
            input.cvv = null; // nunca retornamos

            return CreatedAtAction(nameof(List), new { clienteId }, input);
        }

        // PUT: /api/clientes/{clienteId}/metodos-pago/{id}
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int clienteId, int id, [FromBody] MetodoPagoDto input)
        {
            if (!IsValidTipo(input.Tipo)) return BadRequest(new { message = "Tipo inválido (tarjeta|paypal)." });
            if (string.IsNullOrWhiteSpace(input.Nombre) || input.Nombre.Trim().Length < 3)
                return BadRequest(new { message = "Nombre/Alias es obligatorio (mín. 3)." });

            if (string.Equals(input.Tipo, "tarjeta", StringComparison.OrdinalIgnoreCase))
            {
                var digits = new string((input.NumeroTarjeta ?? "").Where(char.IsDigit).ToArray());
                if (digits.Length < 15) return BadRequest(new { message = "Número de tarjeta inválido (mín. 15 dígitos)." });
                if (string.IsNullOrWhiteSpace(input.cvv) || input.cvv!.Length < 3)
                    return BadRequest(new { message = "CVV inválido (3-4 dígitos)." });
                if (input.ExpMes is null || input.ExpMes < 1 || input.ExpMes > 12)
                    return BadRequest(new { message = "ExpMes inválido (1-12)." });
                if (input.ExpAnio is null || input.ExpAnio < 0)
                    return BadRequest(new { message = "ExpAnio inválido." });
                input.NumeroTarjeta = digits;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(input.Email) || !input.Email.Contains("@"))
                    return BadRequest(new { message = "Email PayPal inválido." });
                input.NumeroTarjeta = null;
                input.cvv = null;
                input.ExpMes = null;
                input.ExpAnio = null;
            }

            using var conn = new SqliteConnection(ConnStr);
            await conn.OpenAsync();

            // Verificar pertenencia
            var chk = conn.CreateCommand();
            chk.CommandText = @"SELECT COUNT(1) FROM ClienteMetodoPago WHERE IdClienteMetodoPago=$id AND IdCliente=$c;";
            chk.Parameters.AddWithValue("$id", id);
            chk.Parameters.AddWithValue("$c", clienteId);
            var exists = Convert.ToInt32(await chk.ExecuteScalarAsync()) > 0;
            if (!exists) return NotFound(new { message = "Método no encontrado." });

            // Si viene como principal, desmarcar otros
            if (input.EsPrincipal)
            {
                var updPrincipal = conn.CreateCommand();
                updPrincipal.CommandText = @"UPDATE ClienteMetodoPago SET EsPrincipal = 0 WHERE IdCliente = $c AND IdClienteMetodoPago <> $id;";
                updPrincipal.Parameters.AddWithValue("$c", clienteId);
                updPrincipal.Parameters.AddWithValue("$id", id);
                await updPrincipal.ExecuteNonQueryAsync();
            }

            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE ClienteMetodoPago
SET Nombre=$Nombre, Tipo=$Tipo, NumeroTarjeta=$NumeroTarjeta, cvv=$cvv, ExpMes=$ExpMes, ExpAnio=$ExpAnio, Email=$Email, EsPrincipal=$EsPrincipal
WHERE IdClienteMetodoPago=$id AND IdCliente=$c;";
            cmd.Parameters.AddWithValue("$Nombre", input.Nombre.Trim());
            cmd.Parameters.AddWithValue("$Tipo", input.Tipo.Trim().ToLowerInvariant());
            cmd.Parameters.AddWithValue("$NumeroTarjeta", (object?)input.NumeroTarjeta ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$cvv", (object?)input.cvv ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ExpMes", (object?)input.ExpMes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ExpAnio", (object?)input.ExpAnio ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$Email", (object?)input.Email ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$EsPrincipal", input.EsPrincipal ? 1 : 0);
            cmd.Parameters.AddWithValue("$id", id);
            cmd.Parameters.AddWithValue("$c", clienteId);

            await cmd.ExecuteNonQueryAsync();

            // Respuesta enmascarada
            var output = new MetodoPagoDto
            {
                IdClienteMetodoPago = id,
                IdCliente = clienteId,
                Nombre = input.Nombre,
                Tipo = input.Tipo,
                NumeroTarjeta = string.Equals(input.Tipo, "tarjeta", StringComparison.OrdinalIgnoreCase) ? MaskCard(input.NumeroTarjeta) : null,
                cvv = null,
                ExpMes = input.ExpMes,
                ExpAnio = input.ExpAnio,
                Email = input.Email,
                EsPrincipal = input.EsPrincipal
            };
            return Ok(output);
        }

        // DELETE: /api/clientes/{clienteId}/metodos-pago/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int clienteId, int id)
        {
            using var conn = new SqliteConnection(ConnStr);
            await conn.OpenAsync();

            var cmd = conn.CreateCommand();
            cmd.CommandText = @"DELETE FROM ClienteMetodoPago WHERE IdClienteMetodoPago=$id AND IdCliente=$c;";
            cmd.Parameters.AddWithValue("$id", id);
            cmd.Parameters.AddWithValue("$c", clienteId);
            var rows = await cmd.ExecuteNonQueryAsync();
            if (rows == 0) return NotFound(new { message = "Método no encontrado." });

            return NoContent();
        }
    }
}
