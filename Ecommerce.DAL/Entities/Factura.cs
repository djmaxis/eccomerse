namespace Ecommerce.DAL.Entities;

public class Factura
{
    public int IdFactura { get; set; }
    public int IdOrden { get; set; }                 // 1-1 con Orden
    public string NumeroFactura { get; set; } = null!;
    public DateTime FechaEmision { get; set; } = DateTime.UtcNow;
    public decimal Total { get; set; }

    public OrdenCompra Orden { get; set; } = null!;
    public ICollection<FacturaItem> Items { get; set; } = new List<FacturaItem>();
}
