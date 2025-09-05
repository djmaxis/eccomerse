namespace Ecommerce.DAL.Entities;

public class Pago
{
    public int IdPago { get; set; }
    public int IdOrden { get; set; }
    public int IdMetodoPago { get; set; }
    public decimal Monto { get; set; }
    public string Estado { get; set; } = "Pendiente"; // Pendiente | Autorizado | Capturado | Rechazado | Reembolsado
    public string? Titular { get; set; }
    public string? RefEnmascarada { get; set; }
    public string? TransaccionRef { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    public OrdenCompra Orden { get; set; } = null!;
    public MetodoPago MetodoPago { get; set; } = null!;
}
