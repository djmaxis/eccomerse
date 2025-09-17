namespace Ecommerce.BLL.DTOs;

public class AuthResultDto
{
    public string Token { get; set; } = null!;
    public string Nombre { get; set; } = null!;
    public string Correo { get; set; } = null!;
}
