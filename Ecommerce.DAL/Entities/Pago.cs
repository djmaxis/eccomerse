namespace Ecommerce.DAL.Entities;

public class Pago
{
    public int IdPago { get; set; }
    public int IdOrden { get; set; }

    // *** Clave con tu esquema real:
    public int IdClienteMetodoPago { get; set; }

    public double Monto { get; set; }
    public string Estado { get; set; } = "pendiente";
    public string? Titular { get; set; }
    public string? RefEnmascarada { get; set; }
    public string? TransaccionRef { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    // Navs
    public OrdenCompra Orden { get; set; } = null!;
    public ClienteMetodoPago ClienteMetodoPago { get; set; } = null!;
}
