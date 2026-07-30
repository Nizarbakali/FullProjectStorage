namespace StudentApi.Models.Entities;

public partial class Donnee
{
    public int DonneeId { get; set; }

    public int ArticleId { get; set; }

    // Nullable temporarily to preserve legacy monthly rows.
    // New CSV and CRUD movements will always require a Case.
    public int? CaseId { get; set; }

    public DateOnly Mois { get; set; }

    public int QuantiteEntrer { get; set; }

    public int QuantiteSortie { get; set; }

    public string Source { get; set; } = "Manuel";

    public virtual Article Article { get; set; } = null!;

    public virtual Case? Case { get; set; }
}