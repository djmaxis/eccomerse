using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceWebAPI.Controllers
{
    [ApiController]
    [Route("api/json")]
    public class JsonController : ControllerBase
    {
        private static readonly JsonSerializerOptions _prettyJson = new()
        {
            WriteIndented = true
        };

        private readonly IWebHostEnvironment _env;

        public JsonController(IWebHostEnvironment env)
        {
            _env = env;
        }

        // POST /api/json/preorder
        [HttpPost("preorder")]
        public async Task<IActionResult> SavePreOrder([FromBody] JsonElement preOrder)
        {
            // webroot = wwwroot
            var webroot = _env.WebRootPath ?? Path.Combine(AppContext.BaseDirectory, "wwwroot");
            var dir = Path.Combine(webroot, "js", "checkout");
            Directory.CreateDirectory(dir);

            var path = Path.Combine(dir, "pre_order.json");

            // Serializa con indentación (reutiliza opciones para performance)
            var json = JsonSerializer.Serialize(preOrder, _prettyJson);

            await System.IO.File.WriteAllTextAsync(path, json, Encoding.UTF8);

            // Devuelve rutas de utilidad
            return Ok(new
            {
                saved = true,
                webPath = "/js/checkout/pre_order.json",
                physicalPath = path
            });
        }
    }
}
