namespace Ecommerce.DAL.Entities;

public class Direccion
{
    public int IdDireccion { get; set; }
    public int IdCliente { get; set; }
    public string Nombre { get; set; } = null!;
    public string Calle { get; set; } = null!;
    public string Pais { get; set; } = null!;
    public string Ciudad { get; set; } = null!;
    public string? CodigoPostal { get; set; }
    public string? Telefono { get; set; }
    public bool EsPrincipal { get; set; }

    public Cliente Cliente { get; set; } = null!;
}
