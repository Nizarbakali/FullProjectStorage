namespace StudentApi.Models.Entities;

public partial class Case
{
    public int CaseId { get; set; }

    public int ZoneId { get; set; }

    public string CodeCase { get; set; } = null!;

    public int? PositionCase { get; set; }

    public int CapaciteMaximum { get; set; }

    public string Statut { get; set; } = null!;

    public virtual Zone Zone { get; set; } = null!;

    public virtual ICollection<Article> Articles { get; set; }
        = new List<Article>();

    public virtual ICollection<Donnee> Donnees { get; set; }
        = new List<Donnee>();
}