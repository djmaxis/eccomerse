namespace Ecommerce.DAL.Entities;

public class FacturaItem
{
    public int IdFacturaItem { get; set; }
    public int IdFactura { get; set; }
    public int IdProducto { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }

    public Factura Factura { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}
