namespace StudentApi.Models.Entities;

public partial class Article
{
    public int ArticleId { get; set; }

    public string CodeArticle { get; set; } = null!;

    public string NomArticle { get; set; } = null!;

    public int? Seuil { get; set; }

    public string? FullLocation { get; set; }

    public bool Actif { get; set; }

    public virtual ICollection<Case> Cases { get; set; }
        = new List<Case>();

    public virtual ICollection<Donnee> Donnees { get; set; }
        = new List<Donnee>();
}