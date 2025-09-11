// Ecommerce.DAL/AppDbContext.cs
using Ecommerce.DAL.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ecommerce.DAL;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Direccion> Direcciones => Set<Direccion>();
    public DbSet<Producto> Productos => Set<Producto>();
    public DbSet<Carrito> Carritos => Set<Carrito>();
    public DbSet<CarritoItem> CarritoItems => Set<CarritoItem>();

    // Ambos disponibles: usa el que prefieras en controladores/servicios
    public DbSet<OrdenCompra> Ordenes => Set<OrdenCompra>();
    public DbSet<OrdenCompra> OrdenesCompra => Set<OrdenCompra>(); // ⬅️ alias para compatibilidad

    public DbSet<OrdenItem> OrdenItems => Set<OrdenItem>();
    public DbSet<ClienteMetodoPago> ClienteMetodosPago => Set<ClienteMetodoPago>();
    public DbSet<Pago> Pagos => Set<Pago>();
    public DbSet<Factura> Facturas => Set<Factura>();
    public DbSet<FacturaItem> FacturaItems => Set<FacturaItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ======================= Cliente =======================
        modelBuilder.Entity<Cliente>(e =>
        {
            e.ToTable("Cliente");
            e.HasKey(x => x.IdCliente);

            e.Property(x => x.Nombre).IsRequired();
            e.Property(x => x.Correo).IsRequired();
            e.Property(x => x.Contrasena).IsRequired();

            e.HasIndex(x => x.Correo).IsUnique();

            // bool -> 0/1 en SQLite
            e.Property(x => x.Activo).HasConversion<int>();
        });

        // ====================== Direccion ======================
        modelBuilder.Entity<Direccion>(e =>
        {
            e.ToTable("Direccion");
            e.HasKey(x => x.IdDireccion);

            e.Property(x => x.Nombre).IsRequired();
            e.Property(x => x.Calle).IsRequired();
            e.Property(x => x.Pais).IsRequired();
            e.Property(x => x.Ciudad).IsRequired();

            e.Property(x => x.EsPrincipal).HasConversion<int>();

            e.HasOne(x => x.Cliente)
             .WithMany(c => c.Direcciones)
             .HasForeignKey(x => x.IdCliente);
        });

        // ====================== Producto =======================
        modelBuilder.Entity<Producto>(e =>
        {
            e.ToTable("Producto");
            e.HasKey(x => x.IdProducto);

            e.Property(x => x.Nombre).IsRequired();
            e.Property(x => x.Precio).HasConversion<double>();
            e.Property(x => x.Stock);
            e.Property(x => x.Activo).HasConversion<int>();

            e.ToTable(tb =>
            {
                tb.HasCheckConstraint("CK_Producto_Precio", "Precio >= 0");
                tb.HasCheckConstraint("CK_Producto_Stock", "Stock >= 0");
            });
        });

        // ======================= Carrito =======================
        modelBuilder.Entity<Carrito>(e =>
        {
            e.ToTable("Carrito");
            e.HasKey(x => x.IdCarrito);

            e.Property(x => x.Estado).HasDefaultValue("Activo");

            e.HasOne(x => x.Cliente)
             .WithMany(c => c.Carritos)
             .HasForeignKey(x => x.IdCliente);
        });

        // ==================== CarritoItem ======================
        modelBuilder.Entity<CarritoItem>(e =>
        {
            e.ToTable("CarritoItem");
            e.HasKey(x => x.IdCarritoItem);

            e.Property(x => x.PrecioUnitario).HasConversion<double>();

            e.HasOne(x => x.Carrito)
             .WithMany(c => c.Items)
             .HasForeignKey(x => x.IdCarrito)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Producto)
             .WithMany(p => p.CarritoItems)
             .HasForeignKey(x => x.IdProducto);

            // Evita duplicados del mismo producto en el mismo carrito
            e.HasIndex(x => new { x.IdCarrito, x.IdProducto }).IsUnique();

            e.HasCheckConstraint("CK_CI_Cantidad", "Cantidad > 0");
            e.HasCheckConstraint("CK_CI_Precio", "PrecioUnitario >= 0");
        });

        // ===================== OrdenCompra =====================
        modelBuilder.Entity<OrdenCompra>(e =>
        {
            e.ToTable("OrdenCompra");
            e.HasKey(x => x.IdOrden);

            e.Property(x => x.Estado).HasDefaultValue("Pagado");

            e.HasOne(x => x.Cliente)
             .WithMany(c => c.Ordenes)
             .HasForeignKey(x => x.IdCliente);

            e.HasOne(x => x.DireccionEnvio)
             .WithMany()
             .HasForeignKey(x => x.IdDireccionEnvio);
        });

        // ====================== OrdenItem ======================
        modelBuilder.Entity<OrdenItem>(e =>
        {
            e.ToTable("OrdenItem");
            e.HasKey(x => x.IdOrdenItem);

            e.Property(x => x.PrecioUnitario).HasConversion<double>();

            e.HasOne(x => x.Orden)
             .WithMany(o => o.Items)
             .HasForeignKey(x => x.IdOrden)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Producto)
             .WithMany(p => p.OrdenItems)
             .HasForeignKey(x => x.IdProducto);

            e.HasCheckConstraint("CK_OI_Cantidad", "Cantidad > 0");
            e.HasCheckConstraint("CK_OI_Precio", "PrecioUnitario >= 0");
        });

        // ============== ClienteMetodoPago (REAL) ===============
        modelBuilder.Entity<ClienteMetodoPago>(e =>
        {
            e.ToTable("ClienteMetodoPago");
            e.HasKey(x => x.IdClienteMetodoPago);

            e.Property(x => x.EsPrincipal).HasConversion<int>();

            e.HasOne(x => x.Cliente)
             .WithMany(c => c.MetodosPago)
             .HasForeignKey(x => x.IdCliente);
        });

        // ========================= Pago ========================
        modelBuilder.Entity<Pago>(e =>
        {
            e.ToTable("Pago");
            e.HasKey(x => x.IdPago);

            e.Property(x => x.Monto).HasConversion<double>();

            e.HasOne(x => x.Orden)
             .WithMany(o => o.Pagos)
             .HasForeignKey(x => x.IdOrden);

            // FK real a ClienteMetodoPago
            e.HasOne(x => x.ClienteMetodoPago)
             .WithMany(m => m.Pagos)
             .HasForeignKey(x => x.IdClienteMetodoPago);

            e.HasCheckConstraint("CK_Pago_Monto", "Monto >= 0");
        });

        // ======================= Factura =======================
        modelBuilder.Entity<Factura>(e =>
        {
            e.ToTable("Factura");
            e.HasKey(x => x.IdFactura);

            e.HasIndex(x => x.IdOrden).IsUnique();
            e.HasIndex(x => x.NumeroFactura).IsUnique();

            e.Property(x => x.Total).HasConversion<double>();

            e.HasOne(x => x.Orden)
             .WithOne(o => o.Factura)
             .HasForeignKey<Factura>(x => x.IdOrden);

            e.HasCheckConstraint("CK_Factura_Total", "Total >= 0");
        });

        // ==================== FacturaItem ======================
        modelBuilder.Entity<FacturaItem>(e =>
        {
            e.ToTable("FacturaItem");
            e.HasKey(x => x.IdFacturaItem);

            e.Property(x => x.PrecioUnitario).HasConversion<double>();

            e.HasOne(x => x.Factura)
             .WithMany(f => f.Items)
             .HasForeignKey(x => x.IdFactura)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Producto)
             .WithMany(p => p.FacturaItems)
             .HasForeignKey(x => x.IdProducto);

            e.HasCheckConstraint("CK_FI_Cantidad", "Cantidad > 0");
            e.HasCheckConstraint("CK_FI_Precio", "PrecioUnitario >= 0");
        });
    }
}
