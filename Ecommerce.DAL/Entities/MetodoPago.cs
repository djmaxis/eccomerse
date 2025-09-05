namespace Ecommerce.DAL.Entities;

public class MetodoPago
{
    public int IdMetodoPago { get; set; }
    public string Codigo { get; set; } = null!;      // Tarjeta, PayPal
    public string NombrePublico { get; set; } = null!;

    public ICollection<Pago> Pagos { get; set; } = new List<Pago>();
}
