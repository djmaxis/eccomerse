namespace Ecommerce.DAL.Entities;

public class CarritoItem
{
    public int IdCarritoItem { get; set; }
    public int IdCarrito { get; set; }
    public int IdProducto { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public DateTime FechaAgregado { get; set; } = DateTime.UtcNow;

    public Carrito Carrito { get; set; } = null!;
    public Producto Producto { get; set; } = null!;
}
