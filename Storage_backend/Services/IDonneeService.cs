using StudentApi.DTOs;

namespace StudentApi.Services;

public interface IDonneeService
{
    Task<IEnumerable<DonneeRowDto>> GetAllAsync();

    Task<DonneeRowDto?> GetByIdAsync(int id);

    Task<DonneeRowDto> CreateAsync(CreateDonneeDto dto);

    Task<DonneeRowDto?> UpdateAsync(
        int id,
        UpdateDonneeDto dto);

    Task<bool> DeleteAsync(int id);

    Task<CsvScanResultDto> ScanCsvAsync(IFormFile file);

    /// <summary>
    /// Vide les données mensuelles et les Articles. L'infrastructure
    /// (Magasins, Rayons, Zones, Cases) et les comptes sont conservés.
    /// </summary>
    Task<PurgeResultDto> PurgeAllAsync();

    /// <param name="replace">
    /// Mode « remplacer » : purge les mouvements et les Articles, puis recrée
    /// les Articles à partir du fichier. Les Magasins, Rayons, Zones et Cases
    /// survivent — le fichier ne porte pas de quoi les reconstruire.
    /// </param>
    Task<CsvUploadResultDto> UploadCsvAsync(
        IFormFile file,
        bool replace = false);

    /// <summary>Simulation d'import : même traitement, aucune écriture.</summary>
    Task<CsvUploadResultDto> SimulateCsvAsync(
        IFormFile file,
        bool replace = false);
}