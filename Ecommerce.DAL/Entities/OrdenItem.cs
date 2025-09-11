namespace Ecommerce.DAL.Entities;

public class OrdenItem
{
    public int IdOrdenItem { get; set; }
    public int IdOrden { get; set; }
    public int IdProducto { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }

    public OrdenCompra Orden { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}
