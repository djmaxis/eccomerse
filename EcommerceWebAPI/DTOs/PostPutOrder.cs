namespace Ecommerce.API.DTOs
{
    public class CheckoutFinalizeRequest
    {
        public int IdCliente { get; set; }
        public int IdDireccionEnvio { get; set; }
        public int IdClienteMetodoPago { get; set; }
        public string? TransaccionRef { get; set; }
    }

    public class CheckoutItemDTO
    {
        public int IdProducto { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public string? Nombre { get; set; }
        public string? ImagenUrl { get; set; }
    }

    public class CheckoutFinalizeResponse
    {
        public int IdOrden { get; set; }
        public int IdFactura { get; set; }
        public string NumeroFactura { get; set; } = "";
        public decimal Total { get; set; }
        public List<CheckoutItemDTO> Items { get; set; } = new();
    }

    public class StockAjusteRequest
    {
        public int IdOrden { get; set; }
    }

    public class ErrorPayload
    {
        public string Message { get; set; } = "";
        public string? InnerDetail { get; set; }
    }
}
