using Microsoft.EntityFrameworkCore;
using StudentApi.Models.Entities;

namespace StudentApi.Data;

public partial class StorageDbContext : DbContext
{
    public StorageDbContext()
    {
    }

    public StorageDbContext(
        DbContextOptions<StorageDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Article> Articles { get; set; }

    public virtual DbSet<Case> Cases { get; set; }

    public virtual DbSet<Donnee> Donnees { get; set; }

    public virtual DbSet<Magasin> Magasins { get; set; }

    public virtual DbSet<Rayon> Rayons { get; set; }

    public virtual DbSet<Zone> Zones { get; set; }

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Article>(entity =>
        {
            entity.HasKey(e => e.ArticleId)
                .HasName("PK_Articles");

            entity.HasIndex(
                    e => e.CodeArticle,
                    "UQ_Articles_CodeArticle")
                .IsUnique();

            entity.Property(e => e.Actif)
                .HasDefaultValue(true);

            entity.Property(e => e.CodeArticle)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.Property(e => e.NomArticle)
                .HasMaxLength(150);

            entity.Property(e => e.FullLocation)
                .HasMaxLength(250);

            // Article many-to-many Cases.
            entity.HasMany(e => e.Cases)
                .WithMany(e => e.Articles)
                .UsingEntity<Dictionary<string, object>>(
                    "ArticleCases",

                    right => right
                        .HasOne<Case>()
                        .WithMany()
                        .HasForeignKey("CaseId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .HasConstraintName(
                            "FK_ArticleCases_Cases"),

                    left => left
                        .HasOne<Article>()
                        .WithMany()
                        .HasForeignKey("ArticleId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .HasConstraintName(
                            "FK_ArticleCases_Articles"),

                    junction =>
                    {
                        junction.ToTable("ArticleCases");

                        junction.HasKey(
                                "ArticleId",
                                "CaseId")
                            .HasName("PK_ArticleCases");
                    });
        });

        modelBuilder.Entity<Case>(entity =>
        {
            entity.HasKey(e => e.CaseId)
                .HasName("PK_Cases");

            entity.HasIndex(
                    e => new
                    {
                        e.ZoneId,
                        e.CodeCase
                    },
                    "UQ_Cases_Zone_Code")
                .IsUnique();

            entity.Property(e => e.CodeCase)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.Property(e => e.Statut)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("Disponible");

            entity.HasOne(e => e.Zone)
                .WithMany(z => z.Cases)
                .HasForeignKey(e => e.ZoneId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Cases_Zones");
        });

        modelBuilder.Entity<Donnee>(entity =>
        {
            entity.HasKey(e => e.DonneeId)
                .HasName("PK_Donnees");

            // Preserves old rows that do not have a Case yet.
            entity.HasIndex(
                    e => new
                    {
                        e.ArticleId,
                        e.Mois
                    },
                    "UQ_Donnees_Legacy_Article_Mois")
                .IsUnique()
                .HasFilter("[CaseId] IS NULL");

            // New Case-specific monthly movement.
            entity.HasIndex(
                    e => new
                    {
                        e.ArticleId,
                        e.CaseId,
                        e.Mois
                    },
                    "UQ_Donnees_Article_Case_Mois")
                .IsUnique()
                .HasFilter("[CaseId] IS NOT NULL");

            entity.Property(e => e.Source)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Manuel");

            entity.HasOne(e => e.Article)
                .WithMany(a => a.Donnees)
                .HasForeignKey(e => e.ArticleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName(
                    "FK_Donnees_Articles");

            entity.HasOne(e => e.Case)
                .WithMany(c => c.Donnees)
                .HasForeignKey(e => e.CaseId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName(
                    "FK_Donnees_Cases");
        });

        modelBuilder.Entity<Magasin>(entity =>
        {
            entity.HasKey(e => e.MagasinId)
                .HasName("PK_Magasins");

            entity.HasIndex(
                    e => e.CodeMagasin,
                    "UQ_Magasins_CodeMagasin")
                .IsUnique();

            entity.Property(e => e.Actif)
                .HasDefaultValue(true);

            entity.Property(e => e.CodeMagasin)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.Property(e => e.NomMagasin)
                .HasMaxLength(150);

            entity.Property(e => e.Pays)
                .HasMaxLength(100);

            entity.Property(e => e.Ville)
                .HasMaxLength(100);

            entity.Property(e => e.Latitude)
                .HasColumnType("float");

            entity.Property(e => e.Longitude)
                .HasColumnType("float");
        });

        modelBuilder.Entity<Rayon>(entity =>
        {
            entity.HasKey(e => e.RayonId)
                .HasName("PK_Rayons");

            entity.HasIndex(
                    e => new
                    {
                        e.MagasinId,
                        e.CodeRayon
                    },
                    "UQ_Rayons_Magasin_Code")
                .IsUnique();

            entity.Property(e => e.Actif)
                .HasDefaultValue(true);

            entity.Property(e => e.CodeRayon)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.Property(e => e.NomRayon)
                .HasMaxLength(150);

            entity.HasOne(e => e.Magasin)
                .WithMany(m => m.Rayons)
                .HasForeignKey(e => e.MagasinId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName(
                    "FK_Rayons_Magasins");
        });

        modelBuilder.Entity<Zone>(entity =>
        {
            entity.HasKey(e => e.ZoneId)
                .HasName("PK_Zones");

            entity.HasIndex(
                    e => new
                    {
                        e.RayonId,
                        e.CodeZone
                    },
                    "UQ_Zones_Rayon_Code")
                .IsUnique();

            entity.Property(e => e.Actif)
                .HasDefaultValue(true);

            entity.Property(e => e.CodeZone)
                .HasMaxLength(50)
                .IsUnicode(false);

            entity.HasOne(e => e.Rayon)
                .WithMany(r => r.Zones)
                .HasForeignKey(e => e.RayonId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName(
                    "FK_Zones_Rayons");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(
        ModelBuilder modelBuilder);
}