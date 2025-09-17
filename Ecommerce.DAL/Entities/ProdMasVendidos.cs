namespace Ecommerce.DAL.Entities;

public class ProdMasVendidos
{
    public int IdPMV { get; set; }                 // PK AUTOINCREMENT
    public int IdProducto { get; set; }            // FK → Producto.IdProducto
    public string Nombre { get; set; } = null!;    // Nombre del producto al momento de la venta
    public DateTime FechaProdVenta { get; set; }   // Se mapea a TEXT en SQLite
    public int Cant { get; set; }                  // CHECK (Cant >= 0)

    // Nav (opcional)
    public Producto? Producto { get; set; }
}
