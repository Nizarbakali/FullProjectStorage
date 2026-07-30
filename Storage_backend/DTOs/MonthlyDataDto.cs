namespace StudentApi.DTOs;

public class DonneeRowDto
{
    public int DonneeId { get; set; }
    public int ArticleId { get; set; }
    public int? CaseId { get; set; }
    public string CodeArticle { get; set; } = string.Empty;
    public string NomArticle { get; set; } = string.Empty;
    public string FullLocation { get; set; } = string.Empty;
    public DateOnly Mois { get; set; }
    public int QuantiteEntrer { get; set; }
    public int QuantiteSortie { get; set; }
    public string Source { get; set; } = string.Empty;
    public int StockArticleCase { get; set; }
    public int QuantiteTotaleCase { get; set; }
    public int CapaciteMaximumCase { get; set; }
    public int CapaciteRestanteCase { get; set; }
    public bool CapaciteDepassee { get; set; }
    public int QuantiteDepassee { get; set; }
    public string? Warning { get; set; }
}

public class CreateDonneeDto
{
    public int ArticleId { get; set; }
    public int CaseId { get; set; }
    public string Mois { get; set; } = string.Empty;
    public int QuantiteEntrer { get; set; }
    public int QuantiteSortie { get; set; }
}

public class UpdateDonneeDto
{
    public int ArticleId { get; set; }
    public int CaseId { get; set; }
    public string Mois { get; set; } = string.Empty;
    public int QuantiteEntrer { get; set; }
    public int QuantiteSortie { get; set; }
}

public class CsvScanResultDto
{
    public List<string> UnknownCodeArticles { get; set; } = [];
    public List<string> UnknownFullLocations { get; set; } = [];
    public int TotalRows { get; set; }
    public List<string> Errors { get; set; } = [];
}

public class CsvUploadResultDto
{
    public bool Succes { get; set; }
    public int TotalLignesLues { get; set; }
    public int LignesInvalides { get; set; }
    public int LignesValidesAvantDoublons { get; set; }
    public int DoublonsExactsIgnores { get; set; }
    public int GroupesEnConflit { get; set; }
    public int LignesEnConflit { get; set; }
    public int LignesDejaExistantes { get; set; }
    public int LignesReellementInserees { get; set; }
    public int LignesLegacyConverties { get; set; }
    public int NouveauxArticlesCrees { get; set; }
    public int LignesCapaciteDepassee { get; set; }
    public List<string> Warnings { get; set; } = [];
    public List<CsvImportErrorDto> Erreurs { get; set; } = [];
    public List<DonneeRowDto> ApercuInserts { get; set; } = [];
}

public class CsvImportErrorDto
{
    public int NumeroLigne { get; set; }
    public string? CodeArticle { get; set; }
    public string? Champ { get; set; }
    public string? Valeur { get; set; }
    public string ValeurOriginale { get; set; } = string.Empty;
    public string Raison { get; set; } = string.Empty;
}
