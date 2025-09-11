namespace Ecommerce.DAL.Entities;

public class OrdenCompra
{
    public int IdOrden { get; set; }
    public int IdCliente { get; set; }
    public int? IdDireccionEnvio { get; set; }
    public string Estado { get; set; } = "Pagado"; // Pagado | PendienteEnvio | Enviado | Recibido | Cancelado
    public string? TrackingNumber { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    public Cliente Cliente { get; set; } = null!;
    public Direccion? DireccionEnvio { get; set; }
    public ICollection<OrdenItem> Items { get; set; } = new List<OrdenItem>();
    public ICollection<Pago> Pagos { get; set; } = new List<Pago>();
    public Factura? Factura { get; set; }
}
