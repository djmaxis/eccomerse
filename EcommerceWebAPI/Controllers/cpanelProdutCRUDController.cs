// Controllers/CpanelProdutCRUDController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using System.Data;
using System.Text;
using System.Text.Json;

namespace Ecommerce.API.Controllers
{
    [ApiController]
    [Route("api/cpanel/productos")]
    public class CpanelProdutCRUDController : ControllerBase
    {
        private readonly IConfiguration _cfg;
        private readonly ILogger<CpanelProdutCRUDController> _logger;
        private readonly IWebHostEnvironment _env;
        private readonly string _connStr;

        public CpanelProdutCRUDController(
            IConfiguration cfg,
            ILogger<CpanelProdutCRUDController> logger,
            IWebHostEnvironment env)
        {
            _cfg = cfg;
            _logger = logger;
            _env = env;

            // Alineado con Program.cs (usa "Default")
            _connStr = _cfg.GetConnectionString("Default") ?? "";
            if (string.IsNullOrWhiteSpace(_connStr))
            {
                var dbPath = Path.Combine(_env.ContentRootPath, "Data", "ecommerce.db");
                _connStr = $"Data Source={dbPath};Cache=Shared";
                _logger.LogWarning("ConnectionStrings:Default no encontrada. Fallback: {dbPath}", dbPath);
            }
        }

        // ========================
        // DTOs
        // ========================
        public class ProductoDto
        {
            public int IdProducto { get; set; }
            public string? RefModelo { get; set; }
            public string Nombre { get; set; } = "";
            public string? Descripcion { get; set; }
            public double Costo { get; set; }
            public double Precio { get; set; }
            public int Stock { get; set; }
            public int Activo { get; set; }  // 1/0
            public string? FechaCreacion { get; set; }
            public string? Image { get; set; }
        }

        public class ProductoCreateUpdateDto
        {
            public string? RefModelo { get; set; }
            public string Nombre { get; set; } = "";
            public string? Descripcion { get; set; }
            public double Costo { get; set; }
            public double Precio { get; set; }
            public int Stock { get; set; }
            public string? Image { get; set; }
            public int? Activo { get; set; } // opcional
        }

        // ========================
        // Utils
        // ========================
        private SqliteConnection OpenConn()
        {
            var cn = new SqliteConnection(_connStr);
            cn.Open();
            return cn;
        }

        private static string NormalizeImage(string? v)
        {
            var s = (v ?? "").Trim();
            if (string.IsNullOrEmpty(s)) return s;
            if (s.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return s;
            if (s.StartsWith("/")) return s;
            if (s.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) return s;
            if (s.StartsWith("img/", StringComparison.OrdinalIgnoreCase)) return s;
            return "image/" + s;
        }

        private static bool HasColumn(IDataRecord rd, string col)
        {
            try { return rd.GetOrdinal(col) >= 0; } catch { return false; }
        }

        private static HashSet<string> GetTableColumns(SqliteConnection cn, string table)
        {
            using var cmd = cn.CreateCommand();
            cmd.CommandText = $"PRAGMA table_info('{table}');";
            var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using var rd = cmd.ExecuteReader();
            while (rd.Read())
                cols.Add(rd.GetString(rd.GetOrdinal("name")));
            return cols;
        }

        private static ProductoDto Map(IDataRecord rd)
        {
            string? GetStr(string c) { try { var i = rd.GetOrdinal(c); return rd.IsDBNull(i) ? null : rd.GetString(i); } catch { return null; } }
            double GetDbl(string c) { try { var i = rd.GetOrdinal(c); return rd.IsDBNull(i) ? 0.0 : Convert.ToDouble(rd.GetValue(i)); } catch { return 0.0; } }
            int GetInt(string c) { try { var i = rd.GetOrdinal(c); return rd.IsDBNull(i) ? 0 : Convert.ToInt32(rd.GetValue(i)); } catch { return 0; } }

            var img = GetStr("image");
            img = NormalizeImage(img);

            return new ProductoDto
            {
                IdProducto = GetInt("IdProducto"),
                RefModelo = GetStr("RefModelo"),
                Nombre = GetStr("Nombre") ?? "",
                Descripcion = GetStr("Descripcion"),
                Costo = GetDbl("Costo"),
                Precio = GetDbl("Precio"),
                Stock = GetInt("Stock"),
                Activo = GetInt("Activo"),
                FechaCreacion = GetStr("FechaCreacion"),
                Image = img
            };
        }

        private static string SafeBody(object? obj)
        {
            try { return obj is null ? "null" : JsonSerializer.Serialize(obj); }
            catch { return "[unserializable]"; }
        }

        // ========================
        // GET: lista (q por Nombre; take=20; orden Nombre ASC)
        // ========================
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductoDto>>> Get([FromQuery] string? q = null, [FromQuery] int take = 20)
        {
            take = (take <= 0 || take > 200) ? 20 : take;

            try
            {
                using var cn = OpenConn();
                var cols = GetTableColumns(cn, "Producto");

                // Armamos el SELECT solo con columnas existentes
                var selCols = new List<string> { "IdProducto", "Nombre", "Precio", "Stock", "Activo" };
                if (cols.Contains("Costo")) selCols.Add("Costo");
                if (cols.Contains("RefModelo")) selCols.Add("RefModelo");
                if (cols.Contains("Descripcion")) selCols.Add("Descripcion");
                if (cols.Contains("FechaCreacion")) selCols.Add("FechaCreacion");
                if (cols.Contains("image")) selCols.Add("image");

                var sql = new StringBuilder();
                sql.Append("SELECT ").Append(string.Join(", ", selCols))
                   .Append(" FROM Producto ")
                   .Append("WHERE (@q IS NULL OR @q = '' OR Nombre LIKE '%' || @q || '%') ")
                   .Append("ORDER BY Nombre ASC ")
                   .Append("LIMIT @take;");

                using var cmd = cn.CreateCommand();
                cmd.CommandText = sql.ToString();
                cmd.Parameters.AddWithValue("@q", (object?)q ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@take", take);

                var list = new List<ProductoDto>();
                using var rd = await cmd.ExecuteReaderAsync();
                while (await rd.ReadAsync())
                    list.Add(Map(rd));

                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GET productos: q={Q} take={Take}", q, take);
                return StatusCode(500, "Error obteniendo productos");
            }
        }

        // ========================
        // GET: por id
        // ========================
        [HttpGet("{id:int}")]
        public async Task<ActionResult<ProductoDto>> GetById(int id)
        {
            if (id <= 0) return BadRequest("Id inválido.");

            try
            {
                using var cn = OpenConn();
                var cols = GetTableColumns(cn, "Producto");

                var selCols = new List<string> { "IdProducto", "Nombre", "Precio", "Stock", "Activo" };
                if (cols.Contains("RefModelo")) selCols.Add("RefModelo");
                if (cols.Contains("Descripcion")) selCols.Add("Descripcion");
                if (cols.Contains("FechaCreacion")) selCols.Add("FechaCreacion");
                if (cols.Contains("image")) selCols.Add("image");

                var sql = $"SELECT {string.Join(", ", selCols)} FROM Producto WHERE IdProducto = @id;";

                using var cmd = cn.CreateCommand();
                cmd.CommandText = sql;
                cmd.Parameters.AddWithValue("@id", id);

                using var rd = await cmd.ExecuteReaderAsync();
                if (await rd.ReadAsync()) return Ok(Map(rd));
                return NotFound();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GET producto id={Id}", id);
                return StatusCode(500, "Error obteniendo producto");
            }
        }

        // ========================
        // POST: crear
        // ========================
        [HttpPost]
        public async Task<ActionResult<ProductoDto>> Post([FromBody] ProductoCreateUpdateDto dto)
        {
            if (dto == null) return BadRequest("Body requerido.");
            if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest("Nombre es obligatorio.");
            if (dto.Precio < 0) return BadRequest("Precio inválido.");
            if (dto.Stock < 0) return BadRequest("Stock inválido.");

            try
            {
                using var cn = OpenConn();
                var cols = GetTableColumns(cn, "Producto");

                // Campos siempre presentes
                var colList = new List<string> { "Nombre", "Precio", "Stock", "Activo" };
                var valList = new List<string> { "@Nombre", "@Precio", "@Stock", "@Activo" };
                if (cols.Contains("Costo")) { colList.Add("Costo"); valList.Add("@Costo"); }

                // Opcionales si existen en la tabla
                if (cols.Contains("RefModelo")) { colList.Add("RefModelo"); valList.Add("@RefModelo"); }
                if (cols.Contains("Descripcion")) { colList.Add("Descripcion"); valList.Add("@Descripcion"); }
                if (cols.Contains("image")) { colList.Add("image"); valList.Add("@Image"); }
                if (cols.Contains("FechaCreacion")) { colList.Add("FechaCreacion"); valList.Add("strftime('%Y-%m-%d %H:%M:%f','now')"); }

                var sql = $@"
INSERT INTO Producto ({string.Join(", ", colList)})
VALUES ({string.Join(", ", valList)});
SELECT last_insert_rowid();";

                using var tx = cn.BeginTransaction();
                using var cmd = cn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = sql;

                // Parámetros
                cmd.Parameters.AddWithValue("@Nombre", dto.Nombre.Trim());
                cmd.Parameters.AddWithValue("@Precio", dto.Precio);
                if (cols.Contains("Costo")) cmd.Parameters.AddWithValue("@Costo", dto.Costo);
                cmd.Parameters.AddWithValue("@Stock", dto.Stock);
                cmd.Parameters.AddWithValue("@Activo", dto.Activo ?? 1);
                if (cols.Contains("RefModelo")) cmd.Parameters.AddWithValue("@RefModelo", (object?)dto.RefModelo ?? DBNull.Value);
                if (cols.Contains("Descripcion")) cmd.Parameters.AddWithValue("@Descripcion", (object?)dto.Descripcion ?? DBNull.Value);
                if (cols.Contains("image")) cmd.Parameters.AddWithValue("@Image", (object?)NormalizeImage(dto.Image) ?? DBNull.Value);

                var newId = Convert.ToInt32((long)await cmd.ExecuteScalarAsync());
                await tx.CommitAsync();

                return await GetById(newId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "POST producto body={Body}", SafeBody(dto));
                return StatusCode(500, "Error creando producto");
            }
        }

        // ========================
        // PUT: actualizar
        // ========================
        [HttpPut("{id:int}")]
        public async Task<ActionResult<ProductoDto>> Put(int id, [FromBody] ProductoCreateUpdateDto dto)
        {
            if (id <= 0) return BadRequest("Id inválido.");
            if (dto == null) return BadRequest("Body requerido.");
            if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest("Nombre es obligatorio.");
            if (dto.Precio < 0) return BadRequest("Precio inválido.");
            if (dto.Stock < 0) return BadRequest("Stock inválido.");

            try
            {
                using var cn = OpenConn();
                var cols = GetTableColumns(cn, "Producto");

                var sets = new List<string>{
                    "Nombre=@Nombre", "Precio=@Precio", "Stock=@Stock", "Activo=@Activo"
                
                };
                if (cols.Contains("Costo")) sets.Add("Costo=@Costo");
                if (cols.Contains("RefModelo")) sets.Add("RefModelo=@RefModelo");
                if (cols.Contains("Descripcion")) sets.Add("Descripcion=@Descripcion");
                if (cols.Contains("image")) sets.Add("image=@Image");

                var sql = $@"UPDATE Producto SET {string.Join(", ", sets)} WHERE IdProducto=@Id;";

                using var cmd = cn.CreateCommand();
                cmd.CommandText = sql;

                cmd.Parameters.AddWithValue("@Id", id);
                cmd.Parameters.AddWithValue("@Nombre", dto.Nombre.Trim());
                cmd.Parameters.AddWithValue("@Precio", dto.Precio);
                if (cols.Contains("Costo")) cmd.Parameters.AddWithValue("@Costo", dto.Costo);
                cmd.Parameters.AddWithValue("@Stock", dto.Stock);
                cmd.Parameters.AddWithValue("@Activo", dto.Activo ?? 1);
                if (cols.Contains("RefModelo")) cmd.Parameters.AddWithValue("@RefModelo", (object?)dto.RefModelo ?? DBNull.Value);
                if (cols.Contains("Descripcion")) cmd.Parameters.AddWithValue("@Descripcion", (object?)dto.Descripcion ?? DBNull.Value);
                if (cols.Contains("image")) cmd.Parameters.AddWithValue("@Image", (object?)NormalizeImage(dto.Image) ?? DBNull.Value);

                var rows = await cmd.ExecuteNonQueryAsync();
                if (rows == 0) return NotFound("Producto no encontrado.");

                return await GetById(id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PUT producto id={Id} body={Body}", id, SafeBody(dto));
                return StatusCode(500, "Error actualizando producto");
            }
        }

        // ========================
        // PATCH: activar / inactivar
        // ========================
        [HttpPatch("{id:int}/activar")]
        public Task<IActionResult> Activar(int id) => SetActivo(id, 1);

        [HttpPatch("{id:int}/inactivar")]
        public Task<IActionResult> Inactivar(int id) => SetActivo(id, 0);

        private async Task<IActionResult> SetActivo(int id, int activo)
        {
            if (id <= 0) return BadRequest("Id inválido.");
            const string sql = @"UPDATE Producto SET Activo = @Activo WHERE IdProducto = @Id;";
            try
            {
                using var cn = OpenConn();
                using var cmd = cn.CreateCommand();
                cmd.CommandText = sql;
                cmd.Parameters.AddWithValue("@Activo", activo);
                cmd.Parameters.AddWithValue("@Id", id);

                var rows = await cmd.ExecuteNonQueryAsync();
                if (rows == 0) return NotFound("Producto no encontrado.");
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PATCH set activo id={Id} activo={Activo}", id, activo);
                return StatusCode(500, "Error cambiando estado del producto");
            }
        }
    }
}
