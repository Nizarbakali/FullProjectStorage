namespace StudentApi.DTOs;

public class ArticleThresholdDto
{
    public int ArticleId { get; set; }

    public string CodeArticle { get; set; } = string.Empty;

    public string NomArticle { get; set; } = string.Empty;

    public int? Seuil { get; set; }
}

public class UpdateArticleThresholdsDto
{
    public int? Seuil { get; set; }
}