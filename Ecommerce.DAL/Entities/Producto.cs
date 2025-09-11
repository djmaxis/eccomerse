namespace Ecommerce.DAL.Entities;

public class Producto
{
    public int IdProducto { get; set; }
    public string? RefModelo { get; set; }
    public string Nombre { get; set; } = null!;
    public string? Descripcion { get; set; }

    // Precio como decimal; EF lo mapea a REAL en SQLite
    public decimal Precio { get; set; }

    public int Stock { get; set; }

    // bool -> en SQLite será 0/1; en JSON sale true/false (tu JS hace Number(true) == 1, funciona)
    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    // 🔹 NUEVO: ruta/URL de imagen. Se serializa como `image` (camelCase)
    public string? Image { get; set; }

    public ICollection<CarritoItem> CarritoItems { get; set; } = new List<CarritoItem>();
    public ICollection<OrdenItem> OrdenItems { get; set; } = new List<OrdenItem>();
    public ICollection<FacturaItem> FacturaItems { get; set; } = new List<FacturaItem>();
}
