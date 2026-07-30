using CsvHelper.Configuration;

namespace StudentApi.Models;

/// <summary>
/// Raw six-column structure required by the monthly CSV import.
/// </summary>
public sealed class CsvRow
{
    public string CodeArticle { get; set; } = string.Empty;
    public string NomArticle { get; set; } = string.Empty;
    public string FullLocation { get; set; } = string.Empty;
    public string Mois { get; set; } = string.Empty;
    public string QuantiteEntrer { get; set; } = string.Empty;
    public string QuantiteSortie { get; set; } = string.Empty;
}

public sealed class CsvRowMap : ClassMap<CsvRow>
{
    public CsvRowMap()
    {
        Map(row => row.CodeArticle).Name("codeArticle");
        Map(row => row.NomArticle).Name("nomArticle");
        Map(row => row.FullLocation).Name("fullLocation");
        Map(row => row.Mois).Name("mois");
        Map(row => row.QuantiteEntrer).Name("QuantiteEntrer");
        Map(row => row.QuantiteSortie).Name("QuantiteSortie");
    }
}