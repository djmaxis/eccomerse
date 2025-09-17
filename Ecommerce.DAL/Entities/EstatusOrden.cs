using System.ComponentModel.DataAnnotations;

public class EstatusOrden
{
    [Key] public int IdEstatusOrden { get; set; }
    public int IdOrden { get; set; }
    [Required] public string NumeroOrden { get; set; } = "";
    [Required] public string Cliente { get; set; } = "";
    [Required] public string Fecha { get; set; } = "";
    [Required] public string Estatus { get; set; } = "";
    // Sugerencia: si quieres guardar tracking aquí:
    // public string? Tracking { get; set; }
}
