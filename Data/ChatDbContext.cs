using Microsoft.EntityFrameworkCore;

namespace DanneFest.Data;

public class ChatDbContext : DbContext
{
    public ChatDbContext(DbContextOptions<ChatDbContext> options) : base(options)
    {
    }

    public DbSet<Message> Messages { get; set; } = null!;
    public DbSet<UnlockedTrigger> UnlockedTriggers { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Konfigurera Message-entiteten
        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.AvatarId).HasMaxLength(50);
            entity.Property(e => e.Text).IsRequired();
            entity.Property(e => e.Timestamp).IsRequired();

            // Index för snabbare queries på Timestamp
            entity.HasIndex(e => e.Timestamp);
        });

        // Konfigurera UnlockedTrigger-entiteten
        modelBuilder.Entity<UnlockedTrigger>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Type).IsRequired().HasMaxLength(10);
            entity.Property(e => e.TriggerValue).IsRequired().HasMaxLength(256);
            entity.Property(e => e.UnlockedAt).IsRequired();

            // Unik kombination av typ + värde (kan inte unlocks samma ord/combo två gånger)
            entity.HasIndex(e => new { e.Type, e.TriggerValue }).IsUnique();
        });
    }
}
