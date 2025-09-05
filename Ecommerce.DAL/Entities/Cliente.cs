namespace Ecommerce.DAL.Entities;

public class Cliente
{
    public int IdCliente { get; set; }
    public string Nombre { get; set; } = null!;
    public string Correo { get; set; } = null!;
    public string Contrasena { get; set; } = null!; // TEXT (no blob)
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    public bool Activo { get; set; } = true;

    public ICollection<Direccion> Direcciones { get; set; } = new List<Direccion>();
    public ICollection<Carrito> Carritos { get; set; } = new List<Carrito>();
    public ICollection<OrdenCompra> Ordenes { get; set; } = new List<OrdenCompra>();
}
