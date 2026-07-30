namespace StudentApi.DTOs;

public class ArticleDto
{
    public int ArticleId { get; set; }
    public string CodeArticle { get; set; } = string.Empty;
    public string NomArticle { get; set; } = string.Empty;
    public List<int> CaseIds { get; set; } = [];
    public string? CodeCase { get; set; }
    public string? FullLocation { get; set; }
    public bool Actif { get; set; }
    public int TotalQuantiteEntrer { get; set; }
    public int TotalQuantiteSortie { get; set; }
    public int StockNet { get; set; }
    public int TotalCaseCapacity { get; set; }
    public int? Seuil { get; set; }
}

public class CreateArticleDto
{
    public string CodeArticle { get; set; } = string.Empty;
    public string NomArticle { get; set; } = string.Empty;
    public List<int> CaseIds { get; set; } = [];
    public bool Actif { get; set; } = true;
    public int? Seuil { get; set; }
}

public class UpdateArticleDto
{
    public string CodeArticle { get; set; } = string.Empty;
    public string NomArticle { get; set; } = string.Empty;
    public List<int> CaseIds { get; set; } = [];
    public bool Actif { get; set; }
    public int? Seuil { get; set; }
}