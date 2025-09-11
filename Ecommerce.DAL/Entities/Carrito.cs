namespace Ecommerce.DAL.Entities;

public class Carrito
{
    public int IdCarrito { get; set; }
    public int IdCliente { get; set; }
    public string Estado { get; set; } = "Activo"; // Activo | Cerrado
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    public Cliente Cliente { get; set; } = null!;
    public ICollection<CarritoItem> Items { get; set; } = new List<CarritoItem>();
}
