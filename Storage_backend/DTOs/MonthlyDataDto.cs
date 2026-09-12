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
    public string? AncienEmplacement { get; set; }
    public DateOnly? DetacheLe { get; set; }
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

/// <summary>
/// Une correction appliquée automatiquement à une ligne du fichier importé.
/// Toutes sont renvoyées au client : l'aperçu les affiche avant l'écriture,
/// de sorte qu'aucune donnée n'est réinterprétée en silence.
/// </summary>
public class CsvCorrectionDto
{
    public int NumeroLigne { get; set; }
    public string? CodeArticle { get; set; }
    public string Champ { get; set; } = string.Empty;
    public string? ValeurOriginale { get; set; }
    public string? ValeurCorrigee { get; set; }
    public string Raison { get; set; } = string.Empty;
}

public class CsvUploadResultDto
{
    public bool Succes { get; set; }

    /// <summary>Vrai lorsque le rapport provient d'une simulation : rien n'a été écrit.</summary>
    public bool Simulation { get; set; }

    /// <summary>
    /// Vrai lorsque l'import s'est exécuté en mode « remplacer » : les
    /// mouvements et les Articles ont été purgés avant l'écriture. Les
    /// Magasins, Rayons, Zones et Cases sont toujours conservés.
    /// </summary>
    public bool Remplacement { get; set; }

    /// <summary>Mouvements purgés par le mode « remplacer ».</summary>
    public int DonneesSupprimees { get; set; }

    /// <summary>Articles purgés par le mode « remplacer ».</summary>
    public int ArticlesSupprimes { get; set; }

    /// <summary>Corrections automatiques appliquées, et nombre de lignes concernées.</summary>
    public List<CsvCorrectionDto> Corrections { get; set; } = [];
    public int LignesCorrigees { get; set; }

    /// <summary>Notes portant sur le fichier entier (encodage, séparateur).</summary>
    public List<string> NotesFichier { get; set; } = [];

    /// <summary>Doublons contradictoires additionnés au lieu d'être rejetés.</summary>
    public int DoublonsFusionnes { get; set; }
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

/// <summary>
/// Bilan d'une purge : ce qui a été retiré de la base. Les Magasins, Rayons,
/// Zones et Cases n'y figurent pas — ils ne sont jamais supprimés.
/// </summary>
public class PurgeResultDto
{
    public int DonneesSupprimees { get; set; }
    public int ArticlesSupprimes { get; set; }
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
