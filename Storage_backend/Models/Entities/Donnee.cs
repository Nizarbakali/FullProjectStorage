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

    // Snapshot preserved when the linked Case is deleted, or unlinked from
    // this movement's Article, so the movement stays readable afterward
    // instead of silently losing where it used to be.
    public string? AncienEmplacement { get; set; }
    public DateOnly? DetacheLe { get; set; }

    public virtual Article Article { get; set; } = null!;

    public virtual Case? Case { get; set; }
}