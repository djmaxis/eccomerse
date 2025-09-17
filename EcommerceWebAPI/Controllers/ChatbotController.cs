// Controllers/ChatbotController.cs
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceWebAPI.Controllers;

[ApiController]
[Route("api/chatbot")]
public class ChatbotController : ControllerBase
{
    // Contexto cacheado (simple, global). Si quieres por usuario, cámbialo por un diccionario por IdCliente/sesión.
    private static object? _cachedContext;

    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<ChatbotController> _logger;

    public ChatbotController(IHttpClientFactory httpFactory, IConfiguration cfg, ILogger<ChatbotController> logger)
    {
        _httpFactory = httpFactory;
        _cfg = cfg;
        _logger = logger;
    }

    // ===== DTOs =====
    public record ChatMessage(string role, string content);
    public record LlmIn(string? prompt, object? context, List<ChatMessage>? history);
    public record LlmOut(string? reply);

    // ==========================
    //  Guarda el JSON de órdenes al abrir el chat
    //  POST /api/chatbot/prime
    // ==========================
    [HttpPost("prime")]
    public IActionResult Prime([FromBody] object context)
    {
        _cachedContext = context;
        return Ok(new { ok = true });
    }

    // ==========================
    //  Limpia el contexto (opcional)
    //  POST /api/chatbot/clear
    // ==========================
    [HttpPost("clear")]
    public IActionResult Clear()
    {
        _cachedContext = null;
        return Ok(new { ok = true });
    }

    // ==========================
    //  Salud (opcional)
    //  GET /api/chatbot/health
    // ==========================
    [HttpGet("health")]
    public IActionResult Health()
        => Ok(new { ok = true, hasContext = _cachedContext is not null });

    // ==========================================================
    //  Chat → DeepSeek (usa contexto enviado + cacheado)
    //  POST /api/chatbot/llm
    //  Body: { "prompt": "texto", "context": { ... }, "history": [{role,content}, ...] }
    //  Respuesta: { "reply": "texto" }
    // ==========================================================
    [HttpPost("llm")]
    public async Task<IActionResult> Llm([FromBody] LlmIn input, CancellationToken ct)
    {
        try
        {
            // 1) API key desde appsettings o variable de entorno (NO la pongas en el front)
            var apiKey =
                _cfg["DeepSeek:ApiKey"] ??
                Environment.GetEnvironmentVariable("DEEPSEEK_API_KEY");

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return StatusCode(500, new
                {
                    error = "missing_api_key",
                    message = "DeepSeek API key no configurada (DeepSeek:ApiKey o env DEEPSEEK_API_KEY)."
                });
            }

            if (!apiKey.StartsWith("sk-", StringComparison.Ordinal))
            {
                return StatusCode(500, new
                {
                    error = "bad_api_key_format",
                    message = "La API key parece incompleta: debe iniciar con 'sk-'."
                });
            }

            // 2) Preparar cliente HTTP
            var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(30);

            // 3) Prompt del sistema
            var systemPrompt = @"
Eres un asistente profesional en español para clientes de e-commerce.
Debes producir SIEMPRE una única salida en **JSON** ESTRICTO (application/json) con este formato:

{
  ""intent"": ""products | order_status | faq | unknown"",
  ""product_matches"": [{ ""IdProducto"": number, ""score"": number }],
  ""order_matches"":   [{ ""IdOrden"": number, ""mask"": string }],
  ""needs_clarification"": boolean,
  ""final_answer"": ""string en español, breve y profesional para el usuario""
}

REGLAS GENERALES (OBLIGATORIAS):
- Usa ÚNICAMENTE los datos del contexto (context_json) que te paso en el mensaje del usuario.
- NO inventes Ids, estados, nombres ni URLs.
- Si un dato no está disponible, usa exactamente: ""No tengo esa información"" en final_answer.
- Formatea precios en en-US con 2 decimales (ej.: $1,234.56).
- Respuestas cortas, claras, amables y profesionales.

CONTEXT_JSON QUE RECIBIRÁS:
- orders: { clienteId, ordenes: [{ IdOrden, IdOrderMask, Estado, TrackingNumber, ... }] }
- products: [{ IdProducto, RefModelo, Nombre, Precio, Stock, Activo }]
- db:
  • products_db: snapshot directo desde la base de datos de la tabla Producto (solo Activo == 1).
  • prodmasvendidos_db: registros de ProdMasVendidos del último año (IdProducto, Cant, FechaProdVenta).

ENRUTAMIENTO POR INTENCIÓN (intent):
- order_status → preguntas de pedidos/facturas/seguimiento/estado/entrega/cancelaciones.
- products     → catálogo, precios, stock, disponibles/agotados, más vendidos (hot sell).
- faq          → horarios, devoluciones, dirección, soporte, ventas por mayor, política general.
- unknown      → cuando no puedas clasificar razonablemente.

PRODUCTOS (catálogo):
- Considera SOLO productos con Activo == 1 (vía products o db.products_db).
- Consultas útiles:
  • ""Tabla de productos completa"" → enumera Nombre y Precio de activos.
  • ""Stock de X"" → responde stock si existe; si falta, ""No tengo esa información"".
  • ""Productos agotados"" → lista donde Stock == 0.

MÁS VENDIDOS (Hot Sell):
- Si preguntan por ""productos más vendidos"", ""hot sell"" o ""más comprados"" SIEMPRE pide precisión: semana, mes o año.
- Solo contesta usando datos del último año (ya filtrados en db.prodmasvendidos_db).
- No devuelvas cifras si el rango no ha sido aclarado; establece needs_clarification = true y pide semana/mes/año.

PEDIDOS (estado y lógica):
- Frases base según Estado:
  • Pagado: ""Su pedido se encuentra pagado. Regularmente demoramos de 1 a 2 días hábiles para el despacho.""
  • Enviado: ""Su pedido se encuentra enviado. Regularmente demoramos de 3 a 5 días hábiles para la entrega.""
  • Completado: ""Su pedido se encuentra completado. Su orden fue entregada satisfactoriamente.""
- Tracking:
  • Si preguntan por tracking y no hay número → ""Ese pedido aún está en proceso de despacho.""
- Cambios/cancelaciones:
  • Estado = Pagado → ""Sí, aún tiene tiempo de hacer cambios o cancelar su orden.""
  • Estado = Enviado/Completado → ""No, su orden ya se encuentra en estado [Estado].""
- Si el usuario no da IdOrden/Mask y hay varias órdenes → needs_clarification = true (pide el id/máscara).

FAQ (información de la tienda):
- Horarios: ""10:00 AM a 6:00 PM (-4GMT)""
- Entregas: ""Trabajamos de lunes a sábado.""
- Devoluciones: ""El pedido debe tener 30 días o menos para devoluciones.""
- Dirección: ""Suite 967 49748 Konopelski Squares, South Troyborough, OH 83248""
- Soporte técnico: ""Contáctenos a través de: https://wa.me/18295463303?text=Necesito%20soporte%20tecnico%20para%20la%20orden:%20\""[IdOrder]\""""
- Ventas por mayor: ""https://wa.me/18295463303?text=Consulta%20ventas%20por%20mayor""

ESTILO Y TONO:
- Profesional, amable, empático y directo. Usa ""usted"" cuando corresponda.

EJEMPLOS:

#1 Estado de pedido (falta id)
Usuario: ""¿Cuál es el estado de mi pedido?""
Salida:
{
  ""intent"": ""order_status"",
  ""product_matches"": [],
  ""order_matches"": [],
  ""needs_clarification"": true,
  ""final_answer"": ""¿Me confirma el ID de la orden o su máscara para revisar el estado?""
}

#2 FAQ
Usuario: ""¿Cuáles son los horarios?""
Salida:
{
  ""intent"": ""faq"",
  ""product_matches"": [],
  ""order_matches"": [],
  ""needs_clarification"": false,
  ""final_answer"": ""Nuestro horario es de 10:00 AM a 6:00 PM (-4GMT).""
}
";


            // 4) Combinar contexto cacheado + contexto que llega + historial (se manda como parte del payload de usuario)
            var mergedContext = new
            {
                cached = _cachedContext,
                provided = input.context,
                history = input.history
            };

            var userPayload = new
            {
                question = input.prompt,
                context_json = mergedContext
            };

            // 5) Construir request para DeepSeek
            var body = new
            {
                model = "deepseek-chat", // modelo de chat
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = JsonSerializer.Serialize(userPayload) }
                },
                temperature = 0.3
            };

            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.deepseek.com/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            // 6) Enviar
            var res = await http.SendAsync(req, ct).ConfigureAwait(false);
            var raw = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("DeepSeek error {Status}: {Body}", (int)res.StatusCode, raw);
                return StatusCode((int)res.StatusCode, new
                {
                    error = "upstream_error",
                    status = (int)res.StatusCode,
                    body = raw
                });
            }

            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;

            // Respuesta estándar: choices[0].message.content
            if (root.TryGetProperty("choices", out var choicesElem) && choicesElem.GetArrayLength() > 0)
            {
                var first = choicesElem[0];
                var content = first.GetProperty("message").GetProperty("content").GetString();

                if (!string.IsNullOrWhiteSpace(content))
                {
                    // DeepSeek devuelve texto; si es JSON válido lo retornamos como JSON, si no como { reply: ... }
                    try
                    {
                        var replyJson = JsonDocument.Parse(content).RootElement;
                        return Ok(replyJson); // devuelve el JSON tal cual (con final_answer, etc.)
                    }
                    catch
                    {
                        return Ok(new { reply = content });
                    }
                }
            }

            // Fallback
            return Ok(new LlmOut("No tengo esa informacion"));
        }
        catch (TaskCanceledException tex) when (tex.CancellationToken == ct)
        {
            // Cancelado por el cliente
            return StatusCode(499, new { error = "client_closed_request", message = "Solicitud cancelada por el cliente." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en /api/chatbot/llm");
            return StatusCode(500, new { error = "exception", message = ex.Message });
        }
    }
}


/*298*/