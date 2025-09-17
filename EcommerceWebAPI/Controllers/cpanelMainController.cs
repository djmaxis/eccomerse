// Controllers/cpanelMainController.cs
using System.Data;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Ecommerce.DAL;

namespace EcommerceWebAPI.Controllers;

[ApiController]
[Route("api/cpanel/main")]
public class CpanelMainController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<CpanelMainController> _logger;

    public CpanelMainController(AppDbContext db, ILogger<CpanelMainController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ====== DTOs ======
    public sealed class StatsDto
    {
        [JsonPropertyName("usuariosRegistrados")]
        public int UsuariosRegistrados { get; set; }

        [JsonPropertyName("ordenesPagadasEnviadas")]
        public int OrdenesPagadasEnviadas { get; set; }

        [JsonPropertyName("ordenesCanceladas")]
        public int OrdenesCanceladas { get; set; }
    }

    public sealed class EstatusOrdenRow
    {
        public string NoOrden { get; set; } = "";
        public string Cliente { get; set; } = "";
        public string Fecha { get; set; } = "";   // TEXT (YYYY-MM-DD)
        public string Estatus { get; set; } = "";
    }

    public sealed class UsuarioRecurrenteRow
    {
        public string Usuario { get; set; } = "";     // Correo
        public int CantOrdenes { get; set; }
        public double TotalGastado { get; set; }
    }

    private async Task<T> ScalarAsync<T>(string sql, params (string, object?)[] parms)
    {
        await using var conn = _db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (name, value) in parms)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? DBNull.Value;
            cmd.Parameters.Add(p);
        }

        var result = await cmd.ExecuteScalarAsync();
        if (result == null || result == DBNull.Value) return default!;
        return (T)Convert.ChangeType(result, typeof(T))!;
    }

    private async Task<List<T>> QueryAsync<T>(string sql, Func<IDataReader, T> map, params (string, object?)[] parms)
    {
        var list = new List<T>();
        await using var conn = _db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (name, value) in parms)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? DBNull.Value;
            cmd.Parameters.Add(p);
        }

        await using var rd = await cmd.ExecuteReaderAsync();
        while (await rd.ReadAsync())
        {
            list.Add(map(rd));
        }
        return list;
    }

    // ====== 1) Stats ======
    [HttpGet("stats")]
    public async Task<ActionResult<StatsDto>> GetStats()
    {
        try
        {
            var usuarios = await ScalarAsync<int>(
                "SELECT COUNT(*) FROM Cliente WHERE Rol = 'cliente';");

            var pagEnv = await ScalarAsync<int>(
                "SELECT COUNT(*) FROM OrdenCompra WHERE Estado IN ('Pagada','Enviada');");

            var cancel = await ScalarAsync<int>(
                "SELECT COUNT(*) FROM OrdenCompra WHERE Estado = 'Cancelada';");

            return Ok(new StatsDto
            {
                UsuariosRegistrados = usuarios,
                OrdenesPagadasEnviadas = pagEnv,
                OrdenesCanceladas = cancel
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo stats del cpanel");
            return StatusCode(500, "Error interno obteniendo estadísticas");
        }
    }

    // ====== 4) Estatus de órdenes (primeros 10 por fecha asc) ======
    [HttpGet("estatus-ordenes")]
    public async Task<ActionResult<IEnumerable<EstatusOrdenRow>>> GetEstatusOrdenes([FromQuery] int take = 10)
    {
        try
        {
            // Si Fecha es TEXT tipo 'YYYY-MM-DD', basta ORDER BY Fecha ASC, IdEstatusOrden ASC
            var sql = @"
                SELECT NumeroOrden AS NoOrden, Cliente, Fecha, Estatus
                FROM EstatusOrden
                ORDER BY Fecha ASC, IdEstatusOrden ASC
                LIMIT @take;";

            var rows = await QueryAsync(sql,
                map: rd => new EstatusOrdenRow
                {
                    NoOrden = rd["NoOrden"]?.ToString() ?? "",
                    Cliente = rd["Cliente"]?.ToString() ?? "",
                    Fecha = rd["Fecha"]?.ToString() ?? "",
                    Estatus = rd["Estatus"]?.ToString() ?? ""
                },
                parms: ("@take", take)
            );

            return Ok(rows);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo EstatusOrden");
            return StatusCode(500, "Error interno obteniendo Estatus de órdenes");
        }
    }

    // ====== 5) Usuarios Recurrentes (top 10 asc por Cant Órdenes) ======
    [HttpGet("usuarios-recurrentes")]
    public async Task<ActionResult<IEnumerable<UsuarioRecurrenteRow>>> GetUsuariosRecurrentes([FromQuery] int take = 10)
    {
        try
        {
            // Agregado desde UsuariosRecurrentesDet (sin canceladas)
            var sql = @"
                SELECT
                  Correo              AS Usuario,
                  COUNT(IdOrden)      AS CantOrdenes,
                  COALESCE(SUM(TotalOrden),0) AS TotalGastado
                FROM UsuariosRecurrentesDet
                GROUP BY Correo
                ORDER BY CantOrdenes ASC, TotalGastado ASC
                LIMIT @take;";

            var rows = await QueryAsync(sql,
                map: rd => new UsuarioRecurrenteRow
                {
                    Usuario = rd["Usuario"]?.ToString() ?? "",
                    CantOrdenes = Convert.ToInt32(rd["CantOrdenes"]),
                    TotalGastado = Convert.ToDouble(rd["TotalGastado"])
                },
                parms: ("@take", take)
            );

            return Ok(rows);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo UsuariosRecurrentes");
            return StatusCode(500, "Error interno obteniendo Usuarios Recurrentes");
        }
    }
}
