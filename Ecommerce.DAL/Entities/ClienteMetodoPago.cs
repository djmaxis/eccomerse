namespace Ecommerce.DAL.Entities;

public class ClienteMetodoPago
{
    public int IdClienteMetodoPago { get; set; }
    public int IdCliente { get; set; }

    public string Nombre { get; set; } = null!; // alias
    public string Tipo { get; set; } = null!;   // 'tarjeta' | 'paypal'

    public string? NumeroTarjeta { get; set; }
    public string? cvv { get; set; }
    public int? ExpMes { get; set; }
    public int? ExpAnio { get; set; }
    public string? Email { get; set; }
    public bool EsPrincipal { get; set; }

    // Navs
    public Cliente Cliente { get; set; } = null!;
    public ICollection<Pago> Pagos { get; set; } = new List<Pago>();
}
